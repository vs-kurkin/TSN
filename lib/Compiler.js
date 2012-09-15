/**
 * @fileOverview Парсер TEN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

var TEN = module.parent.exports,
	path = require('path'),
	Buffer = require(path.join(__dirname, 'Buffer.js')),
	nodeAPI = require(path.join(__dirname, 'tags.js')),
	xml = require(path.join(__dirname, 'SaxParser.js'));

function __error (error, template, buffer, name, line, column) {
	error.templatePath = template.path;
	error.TypeError = 'RenderError';
	error.nodeName = name;
	error.line = line;
	error.column = column;

	TEN.emit('error', error, template);

	if (buffer) {
		buffer.push('<h3>RenderError:<br /> ' + error.toString() + '<br />Template: ' + template.path + '<br />Node name: ' + name + '<br />Line: ' + line + '<br />Column: ' + column + '</h3>');
	}
}

var NS = 'TEN';

var TYPE_ELEMENT_NODE = 1;
var TYPE_TEXT_NODE = 3;
var TYPE_CDATA_SECTION_NODE = 4;
var TYPE_COMMENT_NODE = 8;
var TYPE_DOCUMENT_NODE = 9;

var STATE_TEXT = 1;
var STATE_CODE = 2;

var TEMPLATE_TYPE_TEXT = 1;
var TEMPLATE_TYPE_CODE = 2;
var TEMPLATE_TYPE_INHERIT = 3;

var ERR_UNDEFINED_PREFIX = 'Tag prefix is not defined.';

/**
 * Компилятор TEN-шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} config Объект конфигурации шаблона.
 * @returns {function} Скомпилированый шаблон.
 * @constructor
 */
this.compile = function (source, config) {
	var
		arguments = [TEN, Buffer, __error],
		argumentsName = ['__TEN', '__Buffer', '__error'],
		API = {},
		/**
		 * @name template
		 * @namespace Объект скомпилированного шаблона TEN.
		 * @description Объект скомпилированного шаблона TEN.
		 */
		template,
		name,
		document = {
			type: TYPE_DOCUMENT_NODE,
			children: [],
			namespaces: Object.create(null),
			state: STATE_CODE,
			initCode: ''
		};

	document.current = document;

	for (name in config.API) {
		if (config.API.hasOwnProperty(name)) {
			API[name] = config.API[name];
		}
	}

	new xml.SaxParser(new EventHandler(document, config, API)).parseString(source);

	for (name in API) {
		if (API.hasOwnProperty(name)) {
			arguments.push(API[name]);
			argumentsName.push(name);
		}
	}

	argumentsName.push(
		'var __TEN = this;' +
		'var __path = "' + (typeof config.path === 'string' ? config.path.replace(/("|(?:\r\n)|\r|\n|\\)/g, "\\$1") : 'undefined') + '";' +
		document.initCode +
		'function __template(__stream, __buffer) {' +
			(document.code === '' ? '' : '"use strict";' +
				'var _context = this;' +
				'__buffer = __Buffer(__buffer, __template, __stream);' +
				document.code +
				'return __buffer.end();') +
		'}' +
		'return __template;');

	try {
		template = Function.apply(null, argumentsName).apply(TEN, arguments);
	} catch (error) {
		error.TemplatePath = config.path;
		error.TypeError = 'CompileError';

		TEN.emit('error', error);
		return null;
	}

	/**
	 * @name template.render
	 * @type function
	 * @description Рендеринг шаблона.
	 * @param {object} [context=undefined] Контекст шаблона.
	 * @param {object} [stream=undefined] <a href="http://nodejs.org/docs/latest/api/stream.html#stream_writable_stream">Поток с возможностью записи</a>, в который будет записываться результат рендеринга.
	 * @returns {string} Результат рендеринга.
	 * @example
	 * <pre>
	 *   template.render({}, stream);
	 * </pre>
	 */
	template.render = template.call;

	/**
	 * @name template.path
	 * @type string
	 * @description Абсолютный путь, по которому был скомпилирован шаблон, если он был скомпилирован из файла. Это свойство доступно после наступления события {@link TEN#event:compileEnd}.
	 */
	template.path = config.path;

	return template;
};

function EventHandler (document, config, API) {
	this.document = document;
	this.config = config;
	this.API = API;
}

EventHandler.prototype.onStartDocument = function () {
	var
		code,
		nodeName,
		document = this.document;

	document.code = '';

	for (nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('start')) {
			code = nodeAPI[nodeName].start(document, this.API, TEN);

			if (typeof code == 'string') {
				document.code += code;
			}
		}
	}
};

EventHandler.prototype.onEndDocument = function () {
	var
		code,
		nodeName,
		document = this.document;

	switch (document.state) {
		case STATE_TEXT:
			document.code += '");';
			break;
	}

	document.state = STATE_CODE;

	for (nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('end')) {
			code = nodeAPI[nodeName].end(document, this.API, TEN);

			if (typeof code == 'string') {
				document.code += code;
			}
		}
	}
};

EventHandler.prototype.onStartElementNS = function (parser, elem, attrs, prefix) {
	var
		attrNode,
		attrName,
		attrValue,
		index = 0,
		length = attrs.length,
		uri,
		attributes = {},
		document = this.document,
		current = document.current,
		node = new Node({
			name: elem.toLowerCase(),
			prefix: (prefix || '').toLowerCase(),
			type: TYPE_ELEMENT_NODE,
			attributes: attributes,
			children: [],
			parent: current,
			index: current.children.length,
			namespaces: Object.create(current.namespaces),
			code: '',
			line: parser.getLineNumber(),
			column: parser.getColumnNumber()
		});

	current.children.push(node);
	document.current = node;

	while (index < length) {
		attrNode = attrs[index++];
		attrName = attrNode[0];
		attrValue = attrNode[1];

		if (attrName.slice(0, 5) === 'xmlns') {
			node.namespaces[attrName.slice(6)] = attrValue;

			if (attrValue !== NS) {
				attributes[attrName] = attrValue;
			}
		} else {
			attributes[attrName] = attrValue;
		}
	}

	if (node.prefix === '') {
		node.namespace = node.namespaces[''];
	} else {
		uri = node.namespaces[node.prefix];

		if (typeof uri === 'string' && uri !== '') {
			node.namespace = uri;
		} else {
			this.onError(ERR_UNDEFINED_PREFIX);
		}
	}

	if (node.namespace === NS && nodeAPI.hasOwnProperty(node.name)) {
		node.extend(nodeAPI[node.name]);

		switch (node.templateType) {
			case TEMPLATE_TYPE_TEXT:
				node.state = STATE_TEXT;
				break;

			case TEMPLATE_TYPE_CODE:
				node.state = STATE_CODE;
				break;

			case TEMPLATE_TYPE_INHERIT:
				node.state = node.parent.state;
				break;
		}
	} else {
		node.state = STATE_TEXT;
	}
};

EventHandler.prototype.onEndElementNS = function () {
	var
		result,
		error,
		document = this.document,
		config = this.config,
		current = document.current;

	delete current.namespaces;
	document.current = current.parent;

	if (current.namespace === NS) {
		if (nodeAPI.hasOwnProperty(current.name)) {
			result = current.fixAttributes();

			if (result instanceof Error) {
				error = result.message;
			} else {
				result = typeof current.parse === 'function' ? current.parse(document, this.API, TEN) : true;

				if (result instanceof Error) {
					error = result.message;
				} else {
					current.parent.code += current.compile(this);
					return;
				}
			}
		} else {
			error = 'Unknown tag.';
		}
	}

	if (error) {
		error = new Error(error);

		error.nodeName = current.name;
		error.line = current.line;
		error.column = current.column;
		error.TemplatePath = config.path;
		error.TypeError = 'CompileError';

		TEN.emit('error', error);
	}

	// Output of the code is not valid tag or the HTML tag
	current.value = current.toString();
	current.type = TYPE_TEXT_NODE;

	this.onText(current, false);
};

EventHandler.prototype.onCharacters = function (parser, chars) {
	var current = this.document.current;

	this.onText({
		type: TYPE_TEXT_NODE,
		parent: current,
		value: chars,
		index: current.children.length
	}, true);
};

EventHandler.prototype.onCdata = function (parser, cdata) {
	var current = this.document.current;

	this.onText({
		type: TYPE_CDATA_SECTION_NODE,
		parent: current,
		value: cdata,
		index: current.children.length
	}, true);
};

EventHandler.prototype.onComment = function (parser, comment) {
	var current = this.document.current;

	if (this.config.saveComments === true) {
		this.onText({
			type: TYPE_COMMENT_NODE,
			parent: current,
			value: '<!--' + comment + '-->',
			index: current.children.length
		}, true);
	}
};

EventHandler.prototype.onText = function (node, needFix) {
	var
		text = node.value,
		parent = node.parent;

	if (text === '' || (/^\s+$/).test(text)) {
		return;
	} else {
		text = text.replace(/^\s+([^\s]+)\s+$/, '$1');
	}

	if (needFix) {
		text = text
			.replace(/\\/g, '\\\\')
			.replace(/("|')/g, '\\$1')
			.replace(/(?:\r\n)|\r|\n/g, '\\n')
			.replace(/\f/g, '\\f')
			.replace(/\u2028/g, '\\u2028')
			.replace(/\u2029/g, '\\u2029');
	}

	if (!parent.firstState) {
		parent.firstState = STATE_TEXT;
	}

	parent.children.push(node);

	switch (parent.state) {
		case STATE_CODE:
			text = '__buffer.push("' + text;
			break;
	}

	parent.state = STATE_TEXT;

	parent.code += text;
};

EventHandler.prototype.onError = function (msg) {
	console.log(msg);
};

function Node(propertys) {
	var name;

	for (name in propertys) {
		if (propertys.hasOwnProperty(name)) {
			this[name] = propertys[name];
		}
	}
}

Node.prototype.extend = function (prototype) {
	prototype['__proto__'] = Node.prototype;
	this['__proto__'] = prototype;
};

Node.prototype.toString = function () {
	var
		fullName = this.prefix ? this.prefix + ':' + this.name : this.name,
		result = '<' + fullName,
		name,
		value,
		attributes = this.attributes;

	for (name in attributes) {
		if (attributes.hasOwnProperty(name)) {
			value = attributes[name];

			switch (typeof value) {
				case 'string':
					result += ' ' + name + '=\\"' + value + '\\"';
					break;

				case 'object':
					result += ' ' + name + '=\\"" + (' + value.value + ') + "\\"';
					break;
			}
		}
	}

	if (this.children.length) {
		this.template = '';

		switch (this.state) {
			case STATE_CODE:
				this.code += '__buffer.push("';
				break;

			case STATE_TEXT:
				break;
		}

		result += '>' + this.code + '</' + fullName + '>';
	} else {
		result += '/>';
	}

	this.state = STATE_TEXT;

	return result;
};

Node.prototype.fixAttributes = function  () {
	var
		API = nodeAPI[this.name],
		attrDefinition,
		attrValue,
		attributes,
		name;

	for (name in API.attributes) {
		if (API.attributes.hasOwnProperty(name)) {
			attrDefinition = API.attributes[name];
			attributes = this.attributes;

			if (attributes && attributes.hasOwnProperty(name)) {
				attrValue = attributes[name];

				switch (attrDefinition.type) {
					case 'string':
						attributes[name] = '"' + attrValue.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1") + '"';
						break;
					case 'number':
						if (isNaN(attrValue)) {
							return new Error('The value of the attribute "' + name + '" must be a number', this);
						}
						break;
				}
			} else if (attrDefinition.required === true) {
				return new Error('Attribute "' + name + '" is not defined.');
			} else if (attrDefinition.hasOwnProperty('defaultValue')) {
				if (!attributes) {
					this.attributes = {};
				}

				this.attributes[name] = attrDefinition.defaultValue;
			}
		}
	}

	return true;
};

Node.prototype.compile = (function () {
	var node;

	function replace (result, type, name) {
		switch (type) {
			case '!':
				switch (name) {
					case 'code':
						switch (node.state) {
							case STATE_TEXT:
								node.code += '");';
								node.state = STATE_CODE;
								break;
						}

						return node.code;
					case 'context':
						return node.attributes.hasOwnProperty('context') ? node.attributes.context : 'this';
				}
				break;
			case '@':
				return node.attributes[name] || '';
		}

		return result;
	}

	return function (eventHandler) {
		node = this;

		var
			newState,
			code = '';

		if (typeof this.template === 'string') {
			code = this.template.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, replace);
		} else {
			this.template = '';
		}

		if (this.print === true) {
			code = '__buffer.push(' + code + ');';
		}

		if (this.mayBeError === true) {
			code =
				'try {' + code + '} catch (error) {' +
					(typeof this.templateError === 'string' ? this.templateError : '') +
					'__error(error, __template, ' + (eventHandler.config.debug === true ? '__buffer' : 'null') + ', "' + this.name + '", ' + this.line + ', ' + this.column + ');' +
				'}';

			this.templateType = TEMPLATE_TYPE_CODE;
		}

		if (this.initCode === true) {
			eventHandler.document.initCode += code;
			return '';
		}

		switch (this.templateType) {
			case TEMPLATE_TYPE_TEXT:
				newState = STATE_TEXT;
				break;

			case TEMPLATE_TYPE_CODE:
				newState = STATE_CODE;
				break;

			case TEMPLATE_TYPE_INHERIT:
				newState = this.state;
				break;

			default:
				newState = STATE_CODE;
		}

		switch (this.parent.state) {
			case STATE_TEXT:
				if (newState !== STATE_TEXT) {
					code = '");' + code;
				}
				break;
		}

		if (!this.parent.firstState) {
			this.parent.firstState = newState;
		}

		this.parent.state = newState;

		return code;
	};
}());