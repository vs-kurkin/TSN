/**
 * @fileOverview Templating System for Node.JS.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.2.0 beta
 */

/**
 * @ignore
 */

var LIB = {
	fileSystem: require('fs'),
	path: require('path'),
	event: require('events')
};

var Parser = require(LIB.path.join(__dirname, 'parser.js'));
var nodeAPI = require(LIB.path.join(__dirname, 'tags.js'));

/*
* Event listeners
* */
Parser.prototype.onStart = function () {
	var code;
	this.current.code = '';

	for (var nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('init')) {
			code = nodeAPI[nodeName].init(this);

			if (typeof code == 'string') {
				this.current.code += code;
			}
		}
	}
};

Parser.prototype.onText = function (text, node) {
	node.code += '__output += "' + text + '";';
};

Parser.prototype.onError = function (error) {
	TSN.emit('error', error);
};

Parser.prototype.onOpen = function (node) {
	if (nodeAPI.hasOwnProperty(node.name)) {
		node.body = nodeAPI[node.name].body;
		node.parse = nodeAPI[node.name].parse;
		node.code = '';

		if (node.isEmpty) {
			var parseResult = typeof node.parse === 'function' ? node.parse(this) : true;

			if (parseResult && parseResult.constructor === Error) {
				this._error(parseResult.message, node);
			} else {
				node.parent.code += compileNode(node);
			}
		}
	} else {
		this._error(node.isEmpty ? 'Unknown empty tag.' : 'Unknown tag opening.', node);
	}
};

Parser.prototype.onClose = function (node) {
	if (nodeAPI.hasOwnProperty(node.name)) {
		var parseResult = typeof node.parse === 'function' ? node.parse(this) : true;

		if (parseResult && parseResult.constructor === Error) {
			this._error(parseResult.message, node);
		} else {
			node.parent.code += compileNode(node);
		}
	} else {
		this._error('Unknown tag closing.', node);
	}
};

Parser.prototype.onEntity = function (node) {
	node.parent.code += '__output += String(__entity.' + node.name + ');';
};

function compileNode(node) {
	return node.body.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, function (result, type, name) {
		switch (type) {
			case '!':
				switch (name) {
					case 'code':
						return node.code;
					case 'context':
						return node.attributes.hasOwnProperty('context') ? node.attributes.context : 'this';
				}
				break;
			case '@':
				return node.attributes[name];
		}
	});
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

	var source = 'var __output=""; ' + parser.root.code + '; return __output;';
	var template = new Function (source);

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
 * @return {text} Результат рендеринга.
 */
TSN.render = function (template, data) {
	return template.call(data);
};

function Config (options) {
	for (var property in options) {
		if (options.hasOwnProperty(property)) {
			this[property] = options[property];
		}
	}
}

Config.prototype = TSN.config;

module.exports = TSN;

/**
 * @event
 * @name TSN#error
 * @description Ошибка парсинга шаблона.
 * @param {error} error Объект ошибки.
 * @param {string} error.message Текстовое сообщение ошибки.
 * @param {number} error.nodeName Имя тега, сгенерировавшего ошибку.
 * @param {number} error.line Номер строки, на которой находится тег, сгенерировавший ошибку.
 * @param {number} error.char Символ, с которого начинается тег, сгенерировавший ошибку.
 */