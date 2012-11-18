/**
 * @fileOverview Templating System for Node.JS.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

/**
 * @ignore
 */
var LIB = {
	fileSystem: require('fs'),
	path: require('path'),
	event: require('events')
};

var Config = require(LIB.path.join(__dirname, 'Config.js'));

/**
 * @name TEN
 * @namespace Templating Engine for NodeJS.
 * @description Пространство имен API шаблонизатора, экземпляр <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.
 * @type object
 */
var TEN = module.exports = new LIB.event.EventEmitter();

/**
 * Кеш скомпилированных шаблонов. Имена ключей соответствуют абсолютным путям к файлам шаблонов. Пример использования в описании метода {@link TEN.compileFile}.
 * @type object
 */
TEN.cache = {};

/**
 * @name TEN.config
 * @namespace Объект конфигурации {@link TEN}.
 * @description Объект конфигурации {@link TEN}. Значения по-умолчанию берутся из config.json.
 * @static
 * @type object
 */
TEN.config = Config.prototype;

/**
 * Синхронная компиляция шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} [config] Объект конфигурации шаблона: {@link TEN.config}.
 * @return {function} Скомпилированный шаблон {@link template}.
 * @example
 * <pre>
 * // Компиляция из исходного кода шаблона.
 * TEN.compile("&lt;ten:root xmlns:ten="TEN"&gt;Text&lt;/ten:root&gt;");
 *
 * // Компиляция с использованием кастомного конфига.
 * TEN.compile("&lt;ten:root xmlns:ten="TEN"&gt;Text&lt;/ten:root&gt;", {
 *   saveComments: true
 * });
 * </pre>
 */
TEN.compile = function (source, config) {
	config = new Config(config);

	var template = Compiler(source, config);

	if (template === null) {
		return null;
	}

	if (config.cache === true && typeof config.path === 'string') {
		this.cache[config.path] = template;
	}

	template.path = config.path;

	this.emit('compileEnd', template);

	return template;
};

/**
 * Синхронная компиляция шаблона из файла.
 * @param {string} path Путь к файлу шаблона относительно {@link TEN.config.templateRoot}.
 * @param {object} [config] Объект конфигурации шаблона: {@link TEN.config}.
 * @return {function} Скомпилированный шаблон {@link template}.
 * @example
 * <pre>
 *   // Компиляция файла /home/user/template.xml.
 *   TEN.config.templateRoot = '/home/user';
 *   TEN.compileFile('template.xml');
 *
 *   Компиляция с указанием кастомного конфига.
 *   var template = TEN.compileFile('template.xml', {
 *     removeXMLDeclaration: false
 *   });
 *   TEN.cache.CustomKey === template // true
 * </pre>
 */
TEN.compileFile = function (path, config) {
	config = new Config(config);

	var fullPath = LIB.path.join(config.templateRoot, path);
	var template;

	if (config.cache === true && this.cache.hasOwnProperty(fullPath)) {
		return this.cache[fullPath];
	}

	config.path = fullPath;
	config.dir = LIB.path.dirname(fullPath);

	template = this.compile(LIB.fileSystem.readFileSync(fullPath, config.encoding), config);

	this.emit('compileFileEnd', template);

	return template;
};

/**
 * Асинхронная рекурсивная компиляция файлов, включая вложенные дирректории.
 * @param {string|RegExp} [pattern=/.* /] Расширение файла (строка), либо ругелярное выражение, которому должно соответствовать полное имя файла для компиляции. После завершения компиляции вызывается событие {@link TEN#event:compileDirEnd}.
 * @param {object} [config] Объект конфигурации шаблона: {@link TEN.config}.
 * @example
 * <pre>
 *   // Компилировать только файлы с расширением .html.
 *   TEN.compileDir('html');
 *
 *   // Аналогично предыдущему вызову.
 *   TEN.compileDir(/.+?\.html$/);
 *
 *   // Компилировать все файлы в папке /home/user и подпапках.
 *   TEN.compileDir(null, {
 *     templateRoot: '/home/user'
 *   });
 * </pre>
 */
TEN.compileDir = function (pattern, config) {
	if (typeof pattern === 'string') {
		pattern = new RegExp('.*?\\.' + pattern + '$');
	} else if (!(pattern instanceof RegExp)) {
		pattern = /.*/;
	}

	config = new Config(config);

	var directory = {
		state: 'start',
		path: config.templateRoot,
		childDirsLength: 0
	};

	function callback(error, data) {
		if (error) {
			error.TypeError = 'CompileDirError';
			TEN.emit('error', error);
			return;
		}

		switch (directory.state) {
			case 'start':
				if (data.isDirectory()) {
					directory.state = 'read';

					LIB.fileSystem.readdir(directory.path, callback);
				} else {
					error = new Error('Path ' + directory.path + ' is not a directory.');
					error.TypeError = 'CompileDirError';

					TEN.emit('error', error);
				}
				break;
			case 'read':
				directory.files = data;
				directory.state = 'status';

				if (data.length) {
					directory.currentFile = data.shift();

					LIB.fileSystem.stat(LIB.path.join(directory.path, directory.currentFile), callback);
				} else {
					callback(error, new LIB.fileSystem.Stats());
				}
				break;
			case 'status':
				var path = LIB.path.join(directory.path, directory.currentFile);

				if (data.isFile()) {
					if (pattern.test(directory.currentFile)) {
						config.templateRoot = directory.path;
						TEN.compileFile(LIB.path.relative(directory.path, path), config);
					}
				} else if (data.isDirectory()) {
					config.templateRoot = path;
					var child = TEN.compileDir(pattern, config);

					child.root = directory.root || directory.path;
					child.parent = directory;

					directory.childDirsLength++;
				}

				if (directory.files.length) {
					directory.currentFile = directory.files.shift();
					LIB.fileSystem.stat(LIB.path.join(directory.path, directory.currentFile), callback);
				} else {
					directory.state = 'end';

					while (!directory.childDirsLength) {
						if (directory.parent) {
							directory = directory.parent;
							directory.childDirsLength--;
						} else if (directory.state === 'end') {
							TEN.emit('compileDirEnd', directory.root || directory.path);
							break;
						}
					}

				}
				break;
		}
	}

	LIB.fileSystem.stat(config.templateRoot, callback);

	return directory;
};

/**
 * Рендеринг шаблона.
 * @param {string|function} template Скомпилированный шаблон {@link template} или путь к шаблону, относительно {@link TEN.config.templateRoot}. Если по относительному пути шаблон не был скомпилирован - он будет скомпилирован.
 * @param {object} [context=undefined] Контекст шаблона.
 * @param {object} [stream=undefined] <a href="http://nodejs.org/docs/latest/api/stream.html#stream_writable_stream">Поток с возможностью записи</a>, в который будет записываться результат рендеринга.
 * @return {text} Результат рендеринга, если не использовались асинхронные конструкции.
 * @example
 * <pre>
 *   TEN.config.templateRoot = '/home/user';
 *
 *   // Рендеринг шаблона из /home/user/template.xml.
 *   TEN.render('template.xml', context);
 *
 *   // Аналогично предыдущему вызову.
 *   TEN.compileFile('template.xml');
 *   TEN.render('template.xml', context);
 *
 *   // Аналогично предыдущему вызову.
 *   TEN.render(TEN.compileFile('template.xml'), context);
 * </pre>
 */
TEN.render = function (template, context, stream) {
	switch (typeof template) {
		case 'string':
			var path = LIB.path.join(this.config.templateRoot, template);

			if (this.cache.hasOwnProperty(path)) {
				template = this.cache[path];
			} else {
				template = this.compileFile(template);
			}
			break;

		case 'function':
			break;

		default:
			var error = new Error('First argument "template" must be type string or function.');
			error.TypeError = 'RenderError';

			this.emit('error', error);
	}

	return template.render(context, stream);
};

/**
 * Добавляет поддержку нового TEN-тега.
 * @param {string} name Имя тега.
 * @param {object} definition Объект API тега.
 */
TEN.extendDTD = function (name, definition) {
	tagsDefinition[name] = definition;
};

/**
 *
 * @param {string} template
 * @return {boolean}
 */
TEN.inCache = function (template) {
	var path;

	switch (typeof template) {
		case 'string':
			return this.cache.hasOwnProperty(LIB.path.join(this.config.templateRoot, template));

		case 'function':
			for (path in this.cache) {
				if (this.cache.hasOwnProperty(path) && this.cache[path] === template) {
					return true;
				}
			}
			return false;

		default:
			return false;
	}
};

var Compiler = require(LIB.path.join(__dirname, 'Compiler.js'));
var tagsDefinition = require(LIB.path.join(__dirname, 'tags.js'));
/**
 * @event
 * @name TEN#error
 * @description Ошибка.
 * @param {error} error Объект ошибки.
 * @param {string} error.TypeError Тип ошибки:
 * <ul>
 *   <li><i>CompileError</i> - Ошибка компиляции. Объект ошибки этого типа имеет дополнительные свойства: <b>message</b>, <b>nodeName</b>, <b>line</b>, <b>char</b>.<br /><br /></li>
 *   <li><i>RenderError</i> - Ошибка рендеринга. Объект ошибки этого типа имеет дополнительное свойство <b>templateName</b>.<br /><br /></li>
 *   <li><i>CompileDirError</i> - Ошибка компиляции из директории {@link TEN.compileDir}.</li>
 * </ul>
 *
 * <div>
 *   <b>Дополнительные свойства:</b>
 * </div>
 * <br />
 * @param {string} error.message Текст ошибки.
 * @param {string} error.nodeName Имя тега, сгенерировавшего ошибку.
 * @param {number} error.line Номер строки, на которой находится тег, сгенерировавший ошибку.
 * @param {number} error.char Позиция символа в строке, с которого начинается тег, сгенерировавший ошибку.
 * @param {string} error.templateName Имя шаблона.
 */

/**
 * @event
 * @name TEN#compileEnd
 * @description Завершение компиляции шаблона методом {@link TEN.compile}.
 * @param {function} template Скомпилированный шаблон {@link template}.
 */

/**
 * @event
 * @name TEN#compileFileEnd
 * @description Завершение компиляции шаблона методом {@link TEN.compileFile}. Перед этим событием гинерируется событие {@link TEN#event:compileEnd}.
 * @param {function} template Скомпилированный шаблон {@link template}.
 */

/**
 * @event
 * @name TEN#compileDirEnd
 * @description Завершение компиляции шаблонов из директории методом {@link TEN.compileDir}.
 * @param {string} path Путь к директории, в которой компилировались шаблоны.
 */