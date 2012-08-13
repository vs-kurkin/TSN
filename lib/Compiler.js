/**
 * @fileOverview Парсер TEN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

var TEN = module.parent.exports,
	path = require('path'),
	Stack = require(path.join(__dirname, 'Stack.js')),
	nodeAPI = require(path.join(__dirname, 'tags.js')),
	Parser = require(path.join(__dirname, 'Parser.js'));

var NS = 'TEN';

function render(context, stream, stack) {
	return Function.prototype.apply.call(this, context, [stream, this, stack, Stack, TEN, __error].concat(this.__API));
}

function __error(error, template, stack, name, line, char) {
	error.templatePath = template.path;
	error.TypeError = 'RenderError';
	error.nodeName = name;
	error.line = line;
	error.char = char;

	TEN.emit('error', error, template);

	if (stack) {
		stack.write('<h3>RenderError:<br /> ' + error.toString() + '<br />Template: ' + template.path + '<br />Node name: ' + name + '<br />Line: ' + line + '<br />Char: ' + char + '</h3>');
	}
}

/**
 * Компилятор TEN-шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} config Объект конфигурации шаблона.
 * @return function
 * @constructor
 */
function Compiler(source, config) {
	var
		arguments = ['__stream', '__template', '__stack', '__Stack', '__TEN', '__error'],
		configAPI = config.API,
		API = [],
		document = new Parser(source, config),
		index = 0,
		currentNode = document.documentElement,
		currentChild = currentNode.children[index++];

	this.config = config;

	this.onStart(document);

	this.onOpen(currentNode);

	while (true) {
		if (currentChild) {
			if (currentChild.type === Parser.TYPE_ELEMENT_NODE) {
				this.onOpen(currentChild);

				if (currentChild.isEmpty === true) {
					currentChild = currentNode.children[index++];
				} else {
					index = 0;
					currentNode = currentChild;
					currentChild = currentNode.children[index++];
				}
			} else {
				this.onText(currentChild);

				currentChild = currentNode.children[index++];
			}
		} else {
			if (currentNode === document.documentElement) {
				break;
			} else {
				this.onClose(currentNode);

				index = currentNode.index;
				currentNode = currentNode.parent;
				currentChild = currentNode.children[++index];
			}
		}
	}

	this.onClose(currentNode);

	this.onEnd(document);

	for (var name in configAPI) {
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
			this.documentElement.code +
			'return __stack.end();' +
		'} catch (error) {' +
			'__error(error, __template, ' + (config.debug === true ? '__stack' : 'null') + ', "", 0, 0);' +
			'return __stack.end();' +
		'}');

	try {
		var template = Function.apply(null, arguments);
	} catch (error) {
		this.onError(error);
		return null;
	}

	template.__API = API;
	template.render = render;
	template.path = config.path;

	return template;
}

Compiler.prototype.fixText = function (text) {
	var
		tabSize,
		spaceSize;

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

Compiler.prototype.fixAttributes = function (node) {
	var API = nodeAPI[node.name],
		attrDefinition,
		attrValue,
		attributes,
		name;

	for (name in API.attributes) {
		if (API.attributes.hasOwnProperty(name)) {
			attrDefinition = API.attributes[name];
			attributes = node.attributes;

			if (attributes && attributes.hasOwnProperty(name)) {
				attrValue = attributes[name];

				switch (attrDefinition.type) {
					case 'string':
						attributes[name] = '"' + attrValue.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1") + '"';
						break;
					case 'number':
						if (isNaN(attrValue)) {
							return new Error('The value of the attribute "' + name + '" must be a number', node);
						}
						break;
				}
			} else if (attrDefinition.required === true) {
				return new Error('Attribute "' + name + '" is not defined.');
			} else if (attrDefinition.hasOwnProperty('defaultValue')) {
				if (!attributes) {
					node.attributes = {};
				}

				node.attributes[name] = attrDefinition.defaultValue;
			}
		}
	}
};

Compiler.prototype.compileNode = function (node) {
	var code = '',
		parser = this,
		echo;

	if (node.isEcho === true) {
		if (this.echo) {
			code = ',';
			echo = this.echo;
			echo.names.push(node.name);
			echo.lines.push(node.line);
			echo.chars.push(node.char);
		} else {
			code = 'try {__stack.write(';
			echo = {
				names: [node.name],
				lines: [node.line],
				chars: [node.char]
			}
		}
	} else if (node.mayBeError !== false) {
		node.template = '' +
			'try {' +
				node.template +
			'} catch (error) {' +
				(typeof node.templateError === 'string' ? node.templateError : '') +
				'__error(error, __template, ' + (this.config.debug === true ? '__stack' : 'null') + ', "' + node.name + '", ' + node.line + ', ' + node.char + ');' +
			'}';
	}

	code += node.template.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, function (result, type, name) {
		switch (type) {
			case '!':
				switch (name) {
					case 'code':
						if (parser.echo && node.isEcho !== true) {
							node.code += '");' +
								'} catch (error) {' +
									'__error(error, __template, ' + (parser.config.debug === true ? '__stack' : 'null') + ', "' + parser.echo.names.join(', ') + '", "' + parser.echo.lines.join(', ') + '", "' + parser.echo.chars.join(', ') + '");' +
								'}';
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

	if (node.isEcho === true) {
		this.echo = echo;
	} else {
		delete this.echo;
	}

	return code;
};

Compiler.prototype._error = function (message, node) {
	var error = new Error(message);

	error.nodeName = node.name;
	error.line = node.line;
	error.char = node.char;

	this.onError(error);
};

Compiler.prototype.onStart = function(document) {
	var code,
		nodeName;

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

Compiler.prototype.onEnd = function(document) {
	var code,
		nodeName;

	if (this.echo) {
		document.code += '");' +
			'} catch (error) {' +
			'__error(error, __template, ' + (this.config.debug === true ? '__stack' : 'null') + ', "' + this.echo.names.join(', ') + '", "' + this.echo.lines.join(', ') + '", "' + this.echo.chars.join(', ') + '");' +
			'}';

		delete this.echo;
	}

	for (nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('end')) {
			code = nodeAPI[nodeName].end(TEN);

			if (typeof code == 'string') {
				document.code += code;
			}
		}
	}
};

Compiler.prototype.onError = function(error, node) {
	if (error === Parser.ERR_NOT_CLOSED) {
		this.current.parent.code += this.current.code;
	}

	error.TemplatePath = this.config.path;
	error.TypeError = 'ParseError';

	TEN.emit('error', error);
};

Compiler.prototype.onText = function(node) {
	if (!this.echo) {
		node.parent.code += 'try {__stack.write("';
		this.echo = {
			names: [],
			lines: [],
			chars: []
		};
	}

	node.parent.code += this.fixText(node.value);
};

Compiler.prototype.onOpen = function(node) {
	var
		API,
		result;

	node.code = '';

	if (node.namespace === NS) {
		if (this.echo && node.isEcho !== true) {
			node.parent.code += '");' +
				'} catch (error) {' +
					'__error(error, __template, ' + (this.config.debug === true ? '__stack' : 'null') + ', "' + this.echo.names.join(', ') + '", "' + this.echo.lines.join(', ') + '", "' + this.echo.chars.join(', ') + '");' +
				'}';

			delete this.echo;
		}

		if (nodeAPI.hasOwnProperty(node.name)) {
			API = nodeAPI[node.name];

			node.template = API.template;
			node.parse = API.parse;
			node.isEcho = API.isEcho;
			node.mayBeError = API.mayBeError;
			node.templateError = API.templateError;

			if (node.isEmpty) {
				result = this.fixAttributes(node);

				if (result instanceof Error) {
					this._error(result.message, node);
				} else {
					result = typeof node.parse === 'function' ? node.parse(this, TEN) : true;

					if (result instanceof Error) {
						this._error(result.message, node);
					} else {
						node.parent.code += this.compileNode(node);
					}
				}
			} else {
				this.beforeEcho = this.echo;
				delete this.echo;
			}
		} else if (node.isEmpty) {
			this._error('Unknown empty tag.', node);
		}
	} else {
		this.onText({
			parent: node.parent,
			value: node.toString(),
			index: node.index,
			type: Parser.TYPE_TEXT_NODE
		});
	}
};

Compiler.prototype.onClose = function(node) {
	var
		result;

	if (node.namespace === NS) {
		if (nodeAPI.hasOwnProperty(node.name)) {
			result = this.fixAttributes(node);

			if (result instanceof Error) {
				this._error(result.message, node);
			} else {
				result = typeof node.parse === 'function' ? node.parse(this, TEN) : true;

				if (result && result.constructor === Error) {
					this._error(result.message, node);
				} else {
					node.parent.code += this.compileNode(node);
				}
			}
		} else {
			this._error('Unknown tag.', node);
		}

		this.echo = this.beforeEcho;
		delete this.beforeEcho;
	} else {
		this.onText({
			parent: node.parent,
			value: node.toString(true),
			index: node.index,
			type: Parser.TYPE_TEXT_NODE
		});
	}
};

module.exports = Compiler;

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
 * @name template.path
 * @type string
 * @description Абсолютный путь, по которому был скомпилирован шаблон, если он был скомпилирован из файла. Это свойство доступно после наступления события {@link TEN#event:compileEnd}.
 */