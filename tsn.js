/**
 * @fileOverview Templateting System for Node.JS.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.2 beta
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

var configPath = LIB.path.join(__dirname, 'config.json');
var regExpBody = /\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi;

function compileNode(node) {
	return node.body.replace(regExpBody, function (result, type, name) {
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

/*
* Event listeners
* */
function onStart () {
	this.current.code = '';

	for (var nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('init')) {
			this.current.code += nodeAPI[nodeName].init();
		}
	}
}

function onText (node, text) {
	node.code += '__output += "' + text + '";';
}

function onError (error) {
	TSN.emit('error', error);
}

function onOpen (node) {
	if (nodeAPI.hasOwnProperty(node.name)) {
		node.body = nodeAPI[node.name].body;
		node.parse = nodeAPI[node.name].parse;
		node.code = '';

		if (node.isEmpty) {
			var parseResult = typeof node.parse === 'function' ? node.parse() : true;

			if (parseResult && parseResult.constructor === Error) {
				this._error(parseResult.message, node);
			} else {
				node.parent.code += compileNode(node);
			}
		}
	} else {
		this._error(node.isEmpty ? 'Unknown empty tag.' : 'Unknown tag opening.', node);
	}
}

function onClose (node) {
	if (nodeAPI.hasOwnProperty(node.name)) {
		var parseResult = typeof node.parse === 'function' ? node.parse() : true;

		if (parseResult && parseResult.constructor === Error) {
			this._error(parseResult.message, node);
		} else {
			node.parent.code += compileNode(node);
		}
	} else {
		this._error('Unknown tag closing.', node);
	}
}

function onEntity (node) {
	node.parent.code += '__output += String(__entity.' + node.data + ');';
}

/**
 * @namespace TSN
 */
var TSN = new LIB.event.EventEmitter();

/**
 * Кеш. Содержит все созданные объекты шаблона, загруженные из файла.
 */
TSN.cache = {};

/**
 * Стандартные настройки шаблонизатора.
 */
TSN.config = {};

TSN.load = function (path, name, config, callback) {
	config = config || TSN.config;

	var fullPath = LIB.path.join(config.templateRoot, path);
	var data;

	if (TSN.cache.hasOwnProperty(fullPath)) {
		return TSN.cache[fullPath];
	}

	try {
		LIB.fileSystem.realpathSync(fullPath);
	} catch (error) {
		TSN.emit('error', error);
		return;
	}

	try {
		data = LIB.fileSystem.readFileSync(fullPath, config.encoding);
	} catch (error) {
		TSN.emit('error', error);
		return;
	}

	TSN.compile(data, name || fullPath, config, callback);
};

TSN.compile = function (data, name, config, callback) {
	config = config || TSN.config;

	if (TSN.cache.hasOwnProperty(name)) {
		return TSN.cache[name];
	}

	var parser = new Parser(config);

	parser.once('start', onStart);
	parser.once('end', function () {
		var template = new Function ('var __output=""; ' + this.root.code + '; return __output;');

		if (typeof name === 'string' && name !== '') {
			template.name = name;
			TSN.cache[name] = template;
		}

		if (typeof callback === 'function') {
			callback.call(TSN, template);
		}

		TSN.emit('compiled', template);
	});

	parser.on('open', onOpen);
	parser.on('close', onClose);
	parser.on('text', onText);
	parser.on('entity', onEntity);
	parser.on('error', onError);

	parser.parse(data);
};

TSN.render = function (template, data) {
	return template.call(data);
};

LIB.fileSystem.readFile(configPath, 'utf-8', function (e, data) {
	if (e) {
		e.message = 'Can not read configuration file "' + configPath + '"';
		TSN.emit('error', e);
	} else {
		try {
			var config = JSON.parse(data);

			for (var property in config) {
				if (config.hasOwnProperty(property)) {
					TSN.config[property] = config[property];
				}
			}
		} catch (e) {
			e.message = 'Format error in configuration file "' + configPath + '"';
			TSN.emit('error', e);
		}
	}

	TSN.emit('ready');
});

module.exports = TSN;

/**
 * @name TSN#ready
 * @event
 * @param {Object} event
 * @description Модуль инициализирован и готов к использованию.
 */

/**
 * @name TSN#error
 * @event
 * @param {string} message
 * @param {Object} event
 * @description Ошибка инициализации или парсинга шаблона.
 */

/**
 * @name TSN#compiled
 * @event
 * @param {function} template
 * @description Завершение компиляции шаблона.
 */