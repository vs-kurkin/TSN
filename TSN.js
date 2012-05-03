/**
 * @fileOverview Templating System for Node.JS.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

/**
 * @ignore
 */
var LIB = {
	fileSystem:require('fs'),
	path:require('path'),
	event:require('events')
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
	node.code += (this.inline === true ? ' + ' : '__text = ') + '"' + text + '"';
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
		node.body = API.body;
		node.parse = API.parse;
		node.inline = API.inline;
		node.code = ';';

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

function compileNode(node, parser) {
	var code = node.body.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, function (result, type, name) {
		switch (type) {
			case '!':
				switch (name) {
					case 'code':
						if (node.inline !== true) {
							node.code += '; __output += __text;' +
								'hasStream && __text !== "" && stream.write(__text, "' + parser.config.encoding + '");' +
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
		code = '; __output += __text;' +
			'hasStream && __text !== "" && stream.write(__text, "' + parser.config.encoding + '");' +
			'__text = "";' + code;
	}

	parser.inline = node.inline;

	return code;
}

/**
 * @name TSN
 * @namespace Templating System for NodeJS.
 * @description Экземпляр конструктора <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.
 */
var TSN = new LIB.event.EventEmitter();

/**
 * Кеш скомпилированных шаблонов.
 */
TSN.cache = {};

/**
 * Стандартные настройки шаблонизатора, загруженные из config.json.
 */
TSN.config = JSON.parse(LIB.fileSystem.readFileSync(LIB.path.join(__dirname, 'config.json'), 'utf-8'));

/**
 * Компилирует файл шаблона по указанному пути.
 * @param {string} path Путь к файлу шаблона относительно <i>TSN.config.templateRoot</i>.
 * @param {string} [name] Имя шаблона, по которому он будет храниться в кеше. Если параметр не передан, в качестве имени будет использоваться абсолютный путь к шаблону.
 * @param {object} [config] Объект конфигурации шаблона.
 * @return {function} Скомпилированный шаблон.
 */
TSN.load = function (path, name, config) {
	config = new Config(config);

	var fullPath = LIB.path.join(config.templateRoot, path);

	if (TSN.cache.hasOwnProperty(fullPath)) {
		return TSN.cache[fullPath];
	}

	config.path = LIB.path.dirname(fullPath);
	return TSN.compile(LIB.fileSystem.readFileSync(fullPath, config.encoding), name || fullPath, config);
};

/**
 * Компилирует код шаблона, переданного параметром data.
 * @param {string} data Тело шаблона
 * @param {string} [name] Имя шаблона. Если имя не указано - шаблон не будет сохранен в кеше.
 * @param {object} [config] Объект конфигурации шаблона.
 * @return {function} Скомпилированный шаблон.
 */
TSN.compile = function (data, name, config) {
	config = new Config(config);

	if (TSN.cache.hasOwnProperty(name)) {
		return TSN.cache[name];
	}

	var parser = new Parser(config);
	parser.parse(data);

	var source = '' +
		'"use strict";' +
		'var __output = "";' +
		'var __text = "";' +
		'var hasStream = stream !== void 0;' +
		parser.root.code +
		';' +
		'hasStream && stream.end();' +
		'return __output;';

	var template = new Function('stream', source);

	template.source = source;

	if (typeof name === 'string' && name !== '') {
		template.name = name;
		TSN.cache[name] = template;
	}

	return template;
};

/**
 * Рендеринг шаблона на основе переданных данных.
 * @param {function} template Скомпилированный шаблон.
 * @param {object} data Данные, на основе которых будет рендериться шаблон.
 * @param {object} stream Экземпляр конструктора <a href="http://nodejs.org/docs/latest/api/stream.html">Stream</a>, в который будет записываться результат рендеринга.
 * @return {text} Результат рендеринга.
 */
TSN.render = function (template, data, stream) {
	return template.call(data, stream);
};

/**
 * Добавляет поддержку нового TSN-тега.
 * @param {string} name Имя тега.
 * @param {object} API Объект API тега.
 */
TSN.extend = function (name, API) {
	nodeAPI[name] = API;
};

function Config(options) {
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
 * @description Ошибка парсинга шаблона.
 * @param {error} error Объект ошибки.
 * @param {string} error.message Текстовое сообщение ошибки.
 * @param {string} error.nodeName Имя тега, сгенерировавшего ошибку.
 * @param {number} error.line Номер строки, на которой находится тег, сгенерировавший ошибку.
 * @param {number} error.char Позиция символа в строке, с которого начинается тег, сгенерировавший ошибку.
 */