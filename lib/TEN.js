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

var Parser = require(LIB.path.join(__dirname, 'Parser.js'));
var nodeAPI = require(LIB.path.join(__dirname, 'tags.js'));

Parser.prototype.onStart = function () {
	var code;
	this.current.code = '';

	for (var nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('start')) {
			code = nodeAPI[nodeName].start(this, TEN);

			if (typeof code == 'string') {
				this.current.code += code;
			}
		}
	}
};

Parser.prototype.onEnd = function () {
	var code;

	for (var nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('end')) {
			code = nodeAPI[nodeName].end(this, TEN);

			if (typeof code == 'string') {
				this.current.code += code;
			}
		}
	}
};

Parser.prototype.onText = function (text, node) {
	node.text += text;
	node.code += (this.isEcho === true ? ', ' : '__stack.write(') + '"' + this.fixText(text) + '"';

	this.isEcho = true;
};

Parser.prototype.onEntity = function (node) {
	node.parent.code += (this.isEcho === true ? ', ' : '__stack.write(') + node.name;
	this.isEcho = true;
};

Parser.prototype.onError = function (error) {
	TEN.emit('error', error);
};

Parser.prototype.onOpen = function (node) {
	if (nodeAPI.hasOwnProperty(node.name)) {
		var API = nodeAPI[node.name];

		node.template = API.template;
		node.parse = API.parse;
		node.isEcho = API.isEcho;
		node.code = '';
		node.text = '';

		if (this.isEcho === true && node.isEcho !== true) {
			node.parent.code += ');';
		}

		if (node.isEmpty) {
			var parseResult = typeof node.parse === 'function' ? node.parse(this, TEN) : true;

			if (parseResult && parseResult.constructor === Error) {
				this._error(parseResult.message, node);
			} else {
				node.parent.code += compileNode(node, this);
			}
		} else {

			this.isEcho = false;
		}
	} else {
		this._error(node.isEmpty ? 'Unknown empty tag.' : 'Unknown tag opening.', node);
	}
};

Parser.prototype.onClose = function (node) {
	if (nodeAPI.hasOwnProperty(this.current.name)) {
		var parseResult = typeof this.current.parse === 'function' ? this.current.parse(this, TEN) : true;

		if (parseResult && parseResult.constructor === Error) {
			this._error(parseResult.message, this.current);
		} else {
			this.current.parent.code += compileNode(this.current, this);
		}
	} else {
		this._error('Unknown tag closing.', node);
	}
};

Parser.prototype.fixText = function (text) {
	var tabSize, spaceSize;

	if (this.depth) {
		tabSize = this.depth * (this.config.indent / this.config.tabSize);
		spaceSize = this.depth * this.config.indent;

		text = text.replace(new RegExp('(?:(?:\\r\\n)|\\r|\\n)(?:[\\t]{' + tabSize + '}|[ ]{' + spaceSize + '})', 'g'), '\n');
	}

	return text
		.replace(/\\/g, '\\\\')
		.replace(/("|')/g, '\\$1')
		.replace(/(?:\r\n)|\r|\n/g, '\\n')
		.replace(/\f/g, '\\f')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
};

function compileNode(node, parser) {
	var code = '';

	if (node.isEcho === true) {
		code = parser.isEcho === true ? ',' : '__stack.write(';
	}

	code += node.template.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, function (result, type, name) {
		switch (type) {
			case '!':
				switch (name) {
					case 'code':
						if (parser.isEcho === true && node.isEcho !== true) {
							node.code += ');';
						}

						return node.code;
					case 'context':
						return node.attributes.hasOwnProperty('context') ? node.attributes.context : 'this';
				}
				break;
			case '@':
				return node.attributes[name];
		}
	});

	parser.isEcho = node.isEcho;

	return code;
}

function Stack (stack, stream, template) {
	this.stream = stream || stack.stream;
	this.parent = stack;
	this.template = template;
	this.queue = [];
	this.wait = 0;

	if (stack) {
		this.index = stack.queue.length;
		stack.queue.length++;
		stack.wait++;
	} else {
		this.index = 0;
	}
}

Stack.prototype = new LIB.event.EventEmitter();

Stack.prototype.write = function () {
	if (this.wait) {

	} else {

	}

	this.queue.push(Array.prototype.slice.call(arguments).join(''));
};

Stack.prototype.end = function () {
	var parent = this.parent;
	var result;

	if (!this.wait) {
		result = this.queue.join('');

		this.emit('end', result);

		if (parent) {
			parent.wait--;
			parent.queue[this.index] = result;
			parent.end();

			delete this.parent;
			delete this.queue;
		} else {
			TEN.emit('renderEnd', result, this.template);

			return result;
		}
	}
};

function call(context, stream) {
	return Function.prototype.call.call(this, context, stream, null, this, Stack, TEN);
}

function apply(context, stream) {
	return Function.prototype.apply.call(this, context, [stream, this, TEN]);
}

/**
 * @name TEN
 * @namespace Templating System for NodeJS.
 * @description Пространство имен API шаблонизатора, экземпляр <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.
 * @type function
 */

var TEN = new LIB.event.EventEmitter();

/**
 * Кеш скомпилированных шаблонов. Имена ключей совпадают со значениями свойств {@link TEN.config.cacheKey}, указанными при компиляции. Если шаблон компилируется из файла и параметр {@link TEN.config.cacheKey} не был указан - знечением ключа будет являтся абсолютный путь к файлу шаблона. Пример использования в описании метода {@link TEN.compileFile}.
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
TEN.config = JSON.parse(LIB.fileSystem.readFileSync(LIB.path.join(__dirname, 'config.json'), 'utf-8'));

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
 *   cacheKey: 'CustomName',
 *   saveComments: true
 * });
 * </pre>
 */
TEN.compile = function (source, config) {
	var cacheEnabled = config.cache === true;

	config = new Config(config);

	if (cacheEnabled && TEN.cache.hasOwnProperty(config.cacheKey)) {
		return TEN.cache[config.cacheKey];
	}

	var template = new Parser(source, config);

	source = '' +
		'"use strict";' +

		'try {' +
			'var __context = this;' +
			'var __cacheKey = "' + (typeof config.cacheKey === 'string' ? config.cacheKey.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1") : 'undefined') + '";' +

			'__stack = new __Stack(__stack, __stream, __template);' +

			template.root.code +
			'' +
			'__stack.end();' +
		'} catch (error) {' +
			'error.cacheKey = __cacheKey;' +
			'error.TypeError = "RenderError";' +

			'TEN.emit("error", error, __template);' +
		'}';

	template = new Function('__stream', '__stack', '__template', '__Stack', 'TEN', source);

	template.call = call;
	template.apply = apply;
	template.render = call;
	template.source = source;

	if (cacheEnabled && typeof config.cacheKey === 'string' && config.cacheKey !== '') {
		template.cacheKey = config.cacheKey;
		TEN.cache[config.cacheKey] = template;
	}

	TEN.emit('compileEnd', template);

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
 *     cacheKey: 'CustomKey',
 *     removeXMLDeclaration: false
 *   });
 *   TEN.cache.CustomKey === template // true
 * </pre>
 */
TEN.compileFile = function (path, config) {
	config = new Config(config);

	var fullPath = LIB.path.join(config.templateRoot, path);
	var template;

	if (config.cache === true) {
		if (!config.hasOwnProperty('cacheKey')) {
			config.cacheKey = fullPath;
		}

		if (TEN.cache.hasOwnProperty(config.cacheKey)) {
			return TEN.cache[config.cacheKey];
		}
	}

	config.path = LIB.path.dirname(fullPath);

	template = TEN.compile(LIB.fileSystem.readFileSync(fullPath, config.encoding), config);
	template.path = fullPath;

	TEN.emit('compileFileEnd', template);

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
		dirsLength: 0
	};

	LIB.fileSystem.stat(config.templateRoot, callback);

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
					callback(error, new LIB.fileSystem.Stats);
				}
				break;
			case 'status':
				var path = LIB.path.join(directory.path, directory.currentFile);

				if (data.isFile()) {
					if (pattern.test(directory.currentFile)) {
						TEN.compileFile(LIB.path.relative(directory.path, path), config);
					}
				} else if (data.isDirectory()) {
					config.templateRoot = path;
					var child = TEN.compileDir(pattern, config);

					child.root = directory.root || directory.path;
					child.parent = directory;

					directory.dirsLength++;
				}

				if (directory.files.length) {
					directory.currentFile = directory.files.shift();
					LIB.fileSystem.stat(LIB.path.join(directory.path, directory.currentFile), callback);
				} else {
					var dir = directory;
					directory.state = 'end';

					while (!dir.dirsLength) {
						if (dir.parent) {
							dir = dir.parent;
							dir.dirsLength--;
						} else if (dir.state === 'end') {
							TEN.emit('compileDirEnd', dir.root || dir.path);
							break;
						}
					}

				}
				break;
		}
	}

	return directory;
};

/**
 * Синхронный рендеринг шаблона.
 * @param {string|function} template Скомпилированный шаблон {@link template} или строка, представляющая собой имя шаблона или путь, относительно {@link TEN.config.templateRoot}. Если по относительному пути шаблон не был скомпилирован - он будет скомпилирован.
 * @param {object} [context=undefined] Контекст шаблона.
 * @param {object} [stream=undefined] <a href="http://nodejs.org/docs/latest/api/stream.html#stream_writable_stream">Поток с возможностью записи</a>, в который будет записываться результат рендеринга.
 * @return {text} Результат рендеринга.
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
 *
 *   // Компиляция с произвольным именем и рендеринг с записью результата в поток.
 *   TEN.compileFile('template.xml', {
 *     cacheKey: 'CustomKey'
 *   });
 *   TEN.render('CustomKey', context, stream);
 * </pre>
 */
TEN.render = function (template, context, stream) {
	var path;

	switch (typeof template) {
		case 'string':
			if (TEN.cache.hasOwnProperty(template)) {
				template = TEN.cache[template];
			} else if (TEN.cache.hasOwnProperty(path = LIB.path.join(TEN.config.templateRoot, template))) {
				template = TEN.cache[path];
			} else {
				template = TEN.compileFile(template);
			}
			break;

		case 'function':
			break;

		default:
			var error = new Error('First argument "template" must be type string or function.');
			error.TypeError = 'RenderError';

			TEN.emit('error', error);
			return '';
	}

	return Function.prototype.call.call(template, context, stream, TEN);
};

/**
 * Добавляет поддержку нового TEN-тега.
 * @param {string} name Имя тега.
 * @param {object} API Объект API тега.
 */
TEN.extendDTD = function (name, API) {
	nodeAPI[name] = API;
};

function Config(options) {
	for (var property in options) {
		if (options.hasOwnProperty(property)) {
			this[property] = options[property];
		}
	}
}

Config.prototype = TEN.config;
Config.prototype.constructor = Config;

module.exports = TEN;

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

/**
 * @name template
 * @namespace Объект скомпилированного шаблона TEN.
 * @description Объект скомпилированного шаблона TEN.
 */

/**
 * @name template.render
 * @type function
 * @description Рендеринг шаблона.
 * @param {object} [context=undefined] Контекст шаблона.
 * @param {object} [stream=undefined] <a href="http://nodejs.org/docs/latest/api/stream.html#stream_writable_stream">Поток с возможностью записи</a>, в который будет записываться результат рендеринга.
 * @return {text} Результат рендеринга.
 * @example
 * <pre>
 *   template.render({}, stream);
 * </pre>
 */

/**
 * @name template.call
 * @type function
 * @description Аналогично {@link template.render}.
 */

/**
 * @name template.apply
 * @type function
 * @description Аналогично {@link template.render}.
 */

/**
 * @name template.source
 * @type string
 * @description Скомпилированный код шаблона.
 */

/**
 * @name template.cacheKey
 * @type string
 * @description Имя ключа, по которому этот шаблон находится в кеше {@link TEN.cache}. Совпадает со значением, указанным в {@link TEN.config.cacheKey} при компиляции. Если имя ключа не было указано в конфиге, значение этого свойства будет совпадать с {@link template.path}.
 */

/**
 * @name template.path
 * @type string
 * @description Абсолютный путь, по которому был скомпилирован шаблон, если он был скомпилирован из файла. Это свойство доступно после наступления события {@link TEN#event:compileEnd}.
 */
