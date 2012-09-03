/**
 * @fileOverview Парсер TEN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

var TEN = module.parent.exports,
	path = require('path'),
	Stack = require(path.join(__dirname, 'Stack.js')),
	nodeAPI = require(path.join(__dirname, 'tags.js')),
	xml = require(path.join(__dirname, 'SaxParser.js')),
	compiler = this;

this.NS = 'TEN';

this.TYPE_ELEMENT_NODE = 1;
this.TYPE_TEXT_NODE = 3;
this.TYPE_CDATA_SECTION_NODE = 4;
this.TYPE_COMMENT_NODE = 8;
this.TYPE_DOCUMENT_NODE = 9;

this.STATE_TEXT = 1;
this.STATE_CODE = 2;
this.STATE_CODE_IN_TEXT = 3;

this.TEMPLATE_TYPE_TEXT = 1;
this.TEMPLATE_TYPE_CODE = 2;
this.TEMPLATE_TYPE_INHERIT = 3;

this.ERR_UNDEF_PREFIX = 'Tag prefix is not defined.';

/**
 * Компилятор TEN-шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} config Объект конфигурации шаблона.
 * @returns {function} Скомпилированый шаблон.
 * @constructor
 */
this.compile = function (source, config) {
	var
		arguments = ['__stream', '__template', '__stack', '__Stack', '__TEN', '__error'],
		configAPI = config.API,
		API = [],
		template = null,
		name,
		document = {
			type: compiler.TYPE_DOCUMENT_NODE,
			children: [],
			namespaces: Object.create(null),
			state: compiler.STATE_CODE
		};

	document.current = document;

	new xml.SaxParser(new EventHandler(document, config)).parseString(source);

	for (name in configAPI) {
		if (configAPI.hasOwnProperty(name)) {
			arguments.push(name);
			API.push(configAPI[name]);
		}
	}

	arguments.push(
		'"use strict";' +
		'try {' +
			'var __context = this;' +
			'var __path = "' + (typeof config.path === 'string' ? config.path.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1") : 'undefined') + '";' +
			'__stack = new __Stack(__stack, __template, __stream);' +
			document.code +
			'return __stack.end();' +
		'} catch (error) {' +
			'__error(error, __template, ' + (config.debug === true ? '__stack' : 'null') + ', "", 0, 0);' +
			'return __stack.end();' +
		'}');

	try {
		/**
		 * @name template
		 * @namespace Объект скомпилированного шаблона TEN.
		 * @description Объект скомпилированного шаблона TEN.
		 */
		template = Function.apply(null, arguments);
	} catch (error) {
		error.TemplatePath = config.path;
		error.TypeError = 'CompileError';

		TEN.emit('error', error);
		return template;
	}

	template.__API = API;

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
	template.render = render;

	/**
	 * @name template.path
	 * @type string
	 * @description Абсолютный путь, по которому был скомпилирован шаблон, если он был скомпилирован из файла. Это свойство доступно после наступления события {@link TEN#event:compileEnd}.
	 */
	template.path = config.path;

	return template;
};

function EventHandler (document, config) {
	this.document = document;
	this.config = config;
}

EventHandler.prototype.onStartDocument = function () {
	var
		code,
		nodeName,
		document = this.document;

	document.code = '';

	for (nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('start')) {
			code = nodeAPI[nodeName].start(TEN);

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
		case compiler.STATE_TEXT:
			document.code += '");';
			break;

		case compiler.STATE_CODE_IN_TEXT:
			document.code += ');';
			break;
	}

	document.state = compiler.STATE_CODE;

	for (nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('end')) {
			code = nodeAPI[nodeName].end(TEN);

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
			type: compiler.TYPE_ELEMENT_NODE,
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

			if (attrValue !== compiler.NS) {
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
			this.onError(parser, compiler.ERR_UNDEF_PREFIX);
		}
	}

	if (node.namespace === compiler.NS && nodeAPI.hasOwnProperty(node.name)) {
		node.extend(nodeAPI[node.name]);

		switch (node.templateType) {
			case compiler.TEMPLATE_TYPE_TEXT:
				node.state = compiler.STATE_TEXT;
				break;

			case compiler.TEMPLATE_TYPE_CODE:
				node.state = compiler.STATE_CODE;
				break;

			case compiler.TEMPLATE_TYPE_INHERIT:
				node.state = node.parent.state;
				break;
		}
	} else {
		node.state = compiler.STATE_TEXT;
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

	if (current.namespace === compiler.NS) {
		if (nodeAPI.hasOwnProperty(current.name)) {
			result = current.fixAttributes();

			if (result instanceof Error) {
				error = result.message;
			} else {
				result = typeof current.parse === 'function' ? current.parse(document, TEN) : true;

				if (result instanceof Error) {
					error = result.message;
				} else {
					current.compile(config);
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
	this.onText({
		parent: current.parent,
		value: current.toString(),
		index: current.index,
		type: compiler.TYPE_TEXT_NODE
	}, false);
};

EventHandler.prototype.onCharacters = function (parser, chars) {
	var current = this.document.current;

	this.onText({
		type: compiler.TYPE_TEXT_NODE,
		parent: current,
		value: chars,
		index: current.children.length
	}, true);
};

EventHandler.prototype.onCdata = function (parser, cdata) {
	var current = this.document.current;

	this.onText({
		type: compiler.TYPE_CDATA_SECTION_NODE,
		parent: current,
		value: cdata,
		index: current.children.length
	}, true);
};

EventHandler.prototype.onComment = function (parser, comment) {
	var current = this.document.current;

	if (this.config.saveComments === true) {
		this.onText({
			type: compiler.TYPE_COMMENT_NODE,
			parent: current,
			value: '<!--' + comment + '-->',
			index: current.children.length
		}, true);
	}
};

EventHandler.prototype.onText = function (node, needFix) {
	var
		text,
		parent = node.parent;

	if (needFix) {
		text = node.value
			.replace(/\\/g, '\\\\')
			.replace(/("|')/g, '\\$1')
			.replace(/(?:\r\n)|\r|\n/g, '\\n')
			.replace(/\f/g, '\\f')
			.replace(/\u2028/g, '\\u2028')
			.replace(/\u2029/g, '\\u2029');
	} else {
		text = node.value;
	}

	if (text === '') {
		return;
	}

	if (!parent.firstState) {
		parent.firstState = compiler.STATE_TEXT;
	}

	parent.children.push(node);

	switch (parent.state) {
		case compiler.STATE_CODE:
			text = '__stack.write("' + text;
			break;

		case compiler.STATE_CODE_IN_TEXT:
			text = '+"' + text;
			break;
	}

	parent.state = compiler.STATE_TEXT;

	parent.code += text;
};

EventHandler.prototype.onWarning = function (parser, msg) {
	console.log(msg);
};

EventHandler.prototype.onError = function (parser, msg) {
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
		name;

	for (name in this.attributes) {
		if (this.attributes.hasOwnProperty(name)) {
			result += ' ' + name + '=\\"' + this.attributes[name] + '\\"';
		}
	}

	if (this.children.length) {
		this.template = '';
		result += '>' + this.code + '</' + fullName + '>';
	} else {
		result += '/>';
	}

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

	return function (config) {
		node = this;

		var
			newState,
			code = this.template.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, replace);

		if (this.mayBeError === true) {
			code =
				'try {' + code + '} catch (error) {' +
					(typeof this.templateError === 'string' ? this.templateError : '') +
					'__error(error, __template, ' + (config.debug === true ? '__stack' : 'null') + ', "' + this.name + '", ' + this.line + ', ' + this.column + ');' +
				'}';

			this.templateType = compiler.TEMPLATE_TYPE_CODE;
		}

		switch (this.templateType) {
			case compiler.TEMPLATE_TYPE_TEXT:
				newState = compiler.STATE_CODE_IN_TEXT;
				break;

			case compiler.TEMPLATE_TYPE_CODE:
				newState = compiler.STATE_CODE;
				break;

			case compiler.TEMPLATE_TYPE_INHERIT:
				newState = this.state;
				break;

			default:
				newState = compiler.STATE_CODE;
		}

		switch (this.parent.state) {
			case compiler.STATE_TEXT:
				if (newState !== compiler.STATE_TEXT) {
					code = (this.print === true ? '"+' : '");') + code;
				}
				break;

			case compiler.STATE_CODE:
				if (this.print === true) {
					code = '__stack.write(' + code;
				}
				break;

			case compiler.STATE_CODE_IN_TEXT:
				code = (this.print === true ? '+' : ');') + code;
				break;
		}

		if (!this.parent.firstState) {
			this.parent.firstState = newState;
		}


		this.parent.state = newState;
		this.parent.code += code;
	};
}());

function render (context, stream, stack) {
	return Function.prototype.apply.call(this, context, [stream, this, stack, Stack, TEN, __error].concat(this.__API));
}

function __error (error, template, stack, name, line, column) {
	error.templatePath = template.path;
	error.TypeError = 'RenderError';
	error.nodeName = name;
	error.line = line;
	error.column = column;

	TEN.emit('error', error, template);

	if (stack) {
		stack.write('<h3>RenderError:<br /> ' + error.toString() + '<br />Template: ' + template.path + '<br />Node name: ' + name + '<br />Line: ' + line + '<br />Column: ' + column + '</h3>');
	}
}