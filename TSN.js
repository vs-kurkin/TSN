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
			code = nodeAPI[nodeName].start(this, TSN);

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
			code = nodeAPI[nodeName].end(this, TSN);

			if (typeof code == 'string') {
				this.current.code += code;
			}
		}
	}
};

Parser.prototype.onText = function (text, node) {
	node.text += text.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1');
	node.code += (this.inline === true ? ' + ' : '__text = ') + '"' + this.fixText(text) + '"';

	this.inline = true;
};

Parser.prototype.onEntity = function (node) {
	node.parent.code += (this.inline === true ? ' + ' : '__text = ') + node.name;
	this.inline = true;
};

Parser.prototype.onError = function (error) {
	TSN.emit('error', error);
};

Parser.prototype.onOpen = function (node) {
	if (nodeAPI.hasOwnProperty(node.name)) {
		var API = nodeAPI[node.name];

		node.template = API.template;
		node.parse = API.parse;
		node.inline = API.inline;
		node.code = ';';
		node.text = '';

		if (node.isEmpty) {
			var parseResult = typeof node.parse === 'function' ? node.parse(this, TSN) : true;

			if (parseResult && parseResult.constructor === Error) {
				this._error(parseResult.message, node);
			} else {
				node.parent.code += compileNode(node, this);
			}
		} else {
			this.inline = false;
		}
	} else {
		this._error(node.isEmpty ? 'Unknown empty tag.' : 'Unknown tag opening.', node);
	}
};

Parser.prototype.onClose = function (node) {
	if (nodeAPI.hasOwnProperty(this.current.name)) {
		var parseResult = typeof this.current.parse === 'function' ? this.current.parse(this, TSN) : true;

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

function compileNode (node, parser) {
	var code = node.template.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, function (result, type, name) {
		switch (type) {
			case '!':
				switch (name) {
					case 'code':
						if (node.inline !== true) {
							node.code += ';' +
								'__output += __text;' +
								'__hasStream && __text !== "" && __stream.write(__text, "' + parser.config.encoding + '");' +
								'__text = "";';
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

	if (node.inline === true) {
		code = parser.inline === true ? ' + ' + code : '__text = ' + code;
	} else {
		code = ';' +
			'__output += __text;' +
			'__hasStream && __text !== "" && __stream.write(__text, "' + parser.config.encoding + '");' +
			'__text = "";' + code;
	}

	parser.inline = node.inline;

	return code;
}

function call (context, stream) {
	return Function.prototype.call.call(this, context, stream, TSN);
}

function apply (context, stream) {
	return Function.prototype.apply.call(this, context, [stream, TSN]);
}

/**
 * @name TSN
 * @namespace Templating System for NodeJS.
 * @description Пространство имен API шаблонизатора, экземпляр <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.
 */

var TSN = new LIB.event.EventEmitter();

/**
 * Кеш скомпилированных шаблонов.
 * @type object
 */
TSN.cache = {};

/**
 * @name TSN.config
 * @namespace Объект конфигурации {@link TSN}.
 * @description Объект конфигурации {@link TSN}. Значения по-умолчанию берутся из config.json.
 * @static
 * @type object
 */
TSN.config = JSON.parse(LIB.fileSystem.readFileSync(LIB.path.join(__dirname, 'config.json'), 'utf-8'));

/**
 * Компиляция шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} [config] Объект конфигурации шаблона: {@link TSN.config}.
 * @return {function} Скомпилированный шаблон.
 */
TSN.compile = function (source, config) {
	config = new Config(config);

	if (config.cache === true && config.hasOwnProperty('name') && TSN.cache.hasOwnProperty(config.name)) {
		return TSN.cache[config.name];
	}

	var template = new Parser(source, config);

	source = '' +
		'"use strict";' +

		'var __name = "' + config.name.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1") + '";' +
		'var __output = "";' +
		'var __text = "";' +
		'var __hasStream = __stream !== void 0;' +

		'try {' +
			template.root.code +
			';' +
			'__output += __text;' +
			'__hasStream && __text !== "" && __stream.write(__text, "' + config.encoding + '");' +
		'} catch (error) {' +
			'error.templateName = __name;' +
			'error.TypeError = "RenderError";' +

			'TSN.emit("error", error);' +
		'}' +

		'return __output;';

	template = new Function('__stream', 'TSN', source);

	template.call = call;
	template.apply = apply;
	template.source = source;

	if (config.cache === true && typeof config.name === 'string' && config.name !== '') {
		template.cacheName = config.name;
		TSN.cache[config.name] = template;
	}

	TSN.emit('compile', template);

	return template;
};

/**
 * Синхронная компиляция шаблона из файла.
 * @param {string} path Путь к файлу шаблона относительно <i>TSN.config.templateRoot</i>.
 * @param {object} [config] Объект конфигурации шаблона: {@link TSN.config}.
 * @return {function} Скомпилированный шаблон.
 */
TSN.compileFromFile = function (path, config) {
	config = new Config(config);

	var fullPath = LIB.path.join(config.templateRoot, path);

	if (config.cache === true && TSN.cache.hasOwnProperty(fullPath)) {
		return TSN.cache[fullPath];
	}

	if (!config.hasOwnProperty('name')) {
		config.name = fullPath;
	}

	config.path = LIB.path.dirname(fullPath);
	return TSN.compile(LIB.fileSystem.readFileSync(fullPath, config.encoding), config);
};

/**
* Асинхронная рекурсивная компиляция файлов.
* @param {RegExp} [pattern=/.* /] Ругелярное выражение, которому должно соответствовать имя файла для компиляции.
* @param {string} [path=TSN.config.templateRoot] Путь к дирректории, в которой необходимо компилировать файлы.
*/
TSN.compileFromDir = function (pattern, path) {
	if (!(pattern instanceof RegExp)) {
		pattern = /.*/;
	}

	if (typeof path !== 'string') {
		path = TSN.config.templateRoot;
	}

	var directory = {
		state: 'start',
		path: path,
		dirsLength: 0
	};

	LIB.fileSystem.stat(path, callback);

	function callback (error, data) {
		if (error) {
			error.TypeError = 'CompileDirError';
			TSN.emit('error', error);
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

					TSN.emit('error', error);
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
						TSN.load(LIB.path.relative(directory.root || directory.path, path));
					}
				} else if (data.isDirectory()) {
					var child = TSN.compileDir(pattern, path);

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
							TSN.emit('compileDirEnd', dir.root || dir.path);
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
 * @param {function} template Скомпилированный шаблон.
 * @param {object} [context=undefined] Контекст шаблона.
 * @param {object} [stream=undefined] Экземпляр конструктора <a href="http://nodejs.org/docs/latest/api/stream.html">Stream</a>, в который будет записываться результат рендеринга.
 * @return {text} Результат рендеринга.
 */
TSN.render = function (template, context, stream) {
	return Function.prototype.call.call(template, context, stream, TSN);
};

/**
 * Добавляет поддержку нового TSN-тега.
 * @param {string} name Имя тега.
 * @param {object} API Объект API тега.
 */
TSN.extendDTD = function (name, API) {
	nodeAPI[name] = API;
};

function Config (options) {
	for (var property in options) {
		if (options.hasOwnProperty(property)) {
			this[property] = options[property];
		}
	}
}

Config.prototype = TSN.config;
Config.prototype.constructor = Config;

module.exports = TSN;

/**
 * @event
 * @name TSN#error
 * @description Ошибка.
 * @param {error} error Объект ошибки.
 * @param {string} error.TypeError Тип ошибки:
 * <ul>
 *   <li><i>CompileError</i> - Ошибка компиляции. Объект ошибки этого типа имеет дополнительные свойства: <b>message</b>, <b>nodeName</b>, <b>line</b>, <b>char</b>.<br /><br /></li>
 *   <li><i>RenderError</i> - Ошибка рендеринга. Объект ошибки этого типа имеет дополнительное свойство <b>templateName</b>.<br /><br /></li>
 *   <li><i>CompileDirError</i> - Ошибка компиляции из директории {@link TSN.compileFromDir}.</li>
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
 * @name TSN#compile
 * @description Завершение компиляции шаблона.
 * @param {function} template Скомпилированный шаблон.
 */

/**
 * @event
 * @name TSN#compileDirEnd
 * @description Завершение компиляции шаблонов из директории {@link TSN.compileFromDir}.
 * @param {string} path Путь к директории, в которой компилировались шаблоны.
 */

/**
 * @name TSN.config.namespace
 * @description Префикс пространства имен TSN.
 * @default 'tsn'
 * @type string
 */

/**
 * @name TSN.config.templateRoot
 * @description Корневая директория файлов шаблонов, относительно которой будут разрешаться пути.
 * @default ''
 * @type string
 */

/**
 * @name TSN.config.encoding
 * @description Кодировка файлов шаблонов.
 * @default 'utf-8'
 * @type string
 */

/**
 * @name TSN.config.saveComments
 * @description Если значение параметра false - HTML-комментарии будут удалены из результирующего кода шаблона. <a href="http://msdn.microsoft.com/en-us/library/ms537512(v=vs.85).aspx">Условные комментарии Internet Explorer</a> не будут удалены.
 * @default true
 * @type boolean
 */

/**
 * @name TSN.config.parseCDATA
 * @description Если значение парамерта false - теги TSN не будут отрабатывать в секциях CDATA.
 * @default false
 * @type boolean
 */

/**
 * @name TSN.config.tabSize
 * @description Размер одного символа табуляции в пробелах (если используется символ табуляции).
 * @default 2
 * @type number
 */

/**
 * @name TSN.config.indent
 * @description Размер отступа в пробелах.
 * @default 2
 * @type number
 */

/**
 * @name TSN.config.cache
 * @description Разрешить или запретить кешировать скомпилированные шаблоны.
 * @default true
 * @type boolean
 */

/**
 * @name TSN.config.removeXMLDeclaration
 * @description Если значение параметра true - XML декларация и DTD в начале файла шаблона будут удалены.
 * @default true
 * @type boolean
 */

/**
 * @name TSN.config.name
 * @description Имя шаблона, по которому он будет сохранен в кеше {@link TSN.cache}.
 * @default undefined
 * @type string
 */