/**
 * @fileOverview Парсер TEN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

var path = require('path');

var TEN = module.parent.exports,
	Stack = require(path.join(__dirname, 'Stack.js')),
	nodeAPI = require(path.join(__dirname, 'tags.js'));

var regExpSpace = '(?:(?:(?:\\r\\n)|\\r|\\n)[^\\S\\r\\n]*)*',
	regExpAttr = /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:(?:\\)?"([^"]*?)(?:\\)?")|(?:(?:\\)?'([^']*?)(?:\\)?')))?/gi,
	regExpDTD = '\x3c!DOCTYPE\\s+[a-z\\-_]+(?::[a-z\\-_]+)?(?:(?:\\s+PUBLIC\\s*(?:(?:"[^"]*")|(?:\'[^\']*\'))?\\s*(?:(?:"[^"]*")|(?:\'[^\']*\'))?(?:\\s*\\[[\\s\\S]*?\\])?)|(?:\\s+SYSTEM\\s*(?:(?:"[^"]*")|(?:\'[^\']*\'))?(?:\\[[\\s\\S]*?\\])?)|(?:\\s*\\[[\\s\\S]*?\\]))?\\s*>',
	regExpXML = new RegExp(regExpSpace + '^\\s*<\\?xml(?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*"[^"]*")*\\s*\\?>\\s*(' + regExpSpace + regExpDTD + ')?'),
	regExpCDATA = '|(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)',
	regExpComment = regExpSpace + '<!--(?!\\[if [^\\]]+?\\]>)[\\s\\S]*?(?!<!\\[endif\\])-->';

function call(context, stream, stack) {
	return Function.prototype.apply.call(this, context, [stream, this, stack, Stack, TEN, __error].concat(this.__API));
}

function apply(context, arguments) {
	return Function.prototype.apply.call(this, context, [arguments.shift(), this, arguments.shift(), Stack, TEN, __error].concat(arguments));
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
 * Парсер TEN-шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} config Объект конфигурации шаблона.
 * @return function
 * @constructor
 */
function Template(source, config) {
	var xmlDeclaration = source.match(regExpXML),
		lastIndex = 0,
		parseResult,
		attribute,
		text,
		regExp;

	if (xmlDeclaration) {
		xmlDeclaration = xmlDeclaration[0];
		source = source.substring(xmlDeclaration.length);
	} else {
		xmlDeclaration = '';
	}

	if (!(config.namespace && (/[a-z\d\-_]+/i).test(config.namespace))) {
		this.onError(new Error('Invalid namespace.'));
		config.namespace = 'ten';
	}

	if (typeof config.tabSize !== 'number' || config.tabSize < 1) {
		this.onError(new Error('Invalid tab size.'));
		config.tabSize = 2;
	} else {
		config.tabSize = Number(config.tabSize.toFixed(0));
	}

	if (typeof config.indent !== 'number' || config.indent < 1) {
		this.onError(new Error('Invalid indent.'));
		config.indent = 2;
	} else {
		config.indent = Number(config.indent.toFixed(0));
	}

	regExp = new RegExp('(?:' + regExpSpace + '&' + config.namespace + '.([a-z0-9\\-_\\.]+)?;)|(' + regExpComment + ')' + regExpCDATA + '|(?:' + regExpSpace + '(' + regExpDTD + '))|(?:' + regExpSpace + '<\\/\\s*' + config.namespace + ':([a-z\\-_]+)\\s*>)|(?:' + regExpSpace + '<\\s*' + config.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:(?:\\\\)?"[^"]*(?:\\\\)?")|(?:(?:\\\\)?\'[^\']*(?:\\\\)?\')))*)\\s*(\\/)?>)', 'gi');

	/**
	 * Объект конфигурации шаблона: {@link TEN.config}.
	 * @type object
	 */
	this.config = config;

	/**
	 * Текущая глубина тегов.
	 * @type number
	 */
	this.depth = 0;

	/**
	 * Код XML-декларации.
	 * @type string
	 */
	this.xmlDeclaration = xmlDeclaration;

	/**
	 * Код шаблона без XML-декларации.
	 * @type string
	 */
	this.content = source;

	/**
	 * Текущий объект тега.
	 * @type object
	 */
	this.current = {
		index: 0,
		source: '',
		text: ''
	};

	/**
	 * Объект корневого тега шаблона.
	 * @type object
	 */
	this.root = this.current;

	this.onStart();

	while (parseResult = regExp.exec(source)) {
		var result = parseResult[0],
			entity = parseResult[1],
			comment = parseResult[2],
			dtd = parseResult[3],
			closeNodeName = parseResult[4],
			openNodeName = parseResult[5],
			attributes = parseResult[6],
			isEmpty = parseResult[7],
			index = parseResult.index;

		text = source.substring(lastIndex, index);

		if (text) {
			this.onText(text, this.current);
		}

		if (entity) {
			this.onEntity({
				index: index,
				source: result,
				parent: this.current,
				name: entity
			});
		} else if (openNodeName) {
			var newNode = {
				index: index,
				source: result,
				name: openNodeName.toLowerCase(),
				isEmpty: isEmpty,
				parent: this.current,
				attributes: {}
			};

			while (attribute = regExpAttr.exec(attributes)) {
				newNode.attributes[attribute[1].toLowerCase()] = (attribute[2] || attribute[3])
					.replace(/&amp;/g, '&')
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&quot;/g, '"')
					.replace(/&apos;/g, '\'');
			}

			this.onOpen(newNode);

			if (!isEmpty) {
				this.depth++;
				this.current = newNode;
			}
		} else if (closeNodeName) {
			var parent = this.current.parent;

			closeNodeName = closeNodeName.toLowerCase();

			if (this.current.name === closeNodeName) {
				this.onClose({
					index: index,
					source: result,
					name: closeNodeName,
					parent: parent
				});

				this.depth--;
				this.current = parent;
			} else if (parent && closeNodeName === parent.name) {
				this._error('Tag is not closed.', this.current);

				parent.code += this.current.code;

				this.current = parent;
				this.depth--;

				this.onClose({
					index: index,
					source: result,
					name: closeNodeName,
					parent: parent
				});

				this.current = parent.parent;
				this.depth--;
			} else {
				this._error('Closing tag matches nothing.', {
					index: index,
					source: result,
					name: closeNodeName
				});
			}
		} else if (comment) {
			if (this.config.saveComments === true) {
				this.onText(result, this.current);
			}
		} else { // CDATA or DTD
			this.onText(dtd || result, this.current);
		}

		lastIndex = index + result.length;
	}

	if (text = source.substring(lastIndex)) {
		this.onText(text, this.current);
	}

	if (this.depth) {
		do {
			if (this.current !== this.root) {
				this._error('Tag is not closed.', this.current);
			}
		} while (this.current = this.current.parent);
	}

	this.onEnd();

	source = '' +
		'"use strict";' +

		'try {' +
			'var __context = this;' +
			'var __path = "' + (typeof config.path === 'string' ? config.path.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1") : 'undefined') + '";' +

			'__stack = new __Stack(__stack, __template, __stream);' +
			this.root.code +
			'return __stack.end();' +
		'} catch (error) {' +
			'__error(error, __template, ' + (config.debug === true ? '__stack' : 'null') + ', "", 0, 0);' +
			'return __stack.end();' +
		'}';

	var arguments = ['__stream', '__template', '__stack', '__Stack', '__TEN', '__error'];
	var configAPI = this.config.API;
	var API = [];

	for (var name in configAPI) {
		if (configAPI.hasOwnProperty(name)) {
			arguments.push(name);
			API.push(configAPI[name]);
		}
	}

	arguments.push(source);

	try {
		var template = Function.apply(null, arguments);
	} catch (error) {
		this.onError(error);
		return null;
	}

	template.__API = API;
	template.call = call;
	template.apply = apply;
	template.render = call;
	template.source = source;
	template.path = config.path;

	return template;
}

/**
 * @private
 */
Template.prototype.onStart = function () {
	var code,
		nodeName;

	this.current.code = '';

	for (nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('start')) {
			code = nodeAPI[nodeName].start(this, TEN);

			if (typeof code == 'string') {
				this.current.code += code;
			}
		}
	}
};

/**
 * @private
 */
Template.prototype.onEnd = function () {
	var code,
		nodeName;

	if (this.echo) {
		this.current.code += ');' +
			'} catch (error) {' +
				'__error(error, __template, ' + (this.config.debug === true ? '__stack' : 'null') + ', "' + this.echo.names.join(', ') + '", "' + this.echo.lines.join(', ') + '", "' + this.echo.chars.join(', ') + '");' +
			'}';

		delete this.echo;
	}

	for (nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('end')) {
			code = nodeAPI[nodeName].end(this, TEN);

			if (typeof code == 'string') {
				this.current.code += code;
			}
		}
	}
};

/**
 * @private
 */
Template.prototype.onText = function (text, node) {
	node.text += text;

	if (this.echo) {
		node.code += '+';
	} else {
		node.code += 'try {__stack.write(';
		this.echo = {
			names: [],
			lines: [],
			chars: []
		};
	}

	node.code += '"' + this.fixText(text) + '"';
};

/**
 * @private
 */
Template.prototype.onEntity = function (node) {
	var echo = this.echo,
		parent = node.parent;

	this.setNodeData(node);

	if (echo) {
		parent.code += '+';
		echo.names.push('ENTITY');
		echo.lines.push(node.line);
		echo.chars.push(node.char);
	} else {
		parent.code += 'try {__stack.write(';
		this.echo = {
			names: ['ENTITY'],
			lines: [node.line],
			chars: [node.char]
		};
	}

	parent.code += node.name;
};

/**
 * @private
 */
Template.prototype.onError = function (error) {
	error.TemplatePath = this.config.path;
	error.TypeError = 'CompileError';

	TEN.emit('error', error);
};

/**
 * @private
 */
Template.prototype.onOpen = function (node) {
	var API,
		result;

	node.code = '';
	node.text = '';

	if (this.echo && node.isEcho !== true) {
		node.parent.code += ');' +
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
				this.setNodeData(node);

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
};

/**
 * @private
 */
Template.prototype.onClose = function (node) {
	var result;

	if (nodeAPI.hasOwnProperty(this.current.name)) {
		result = this.fixAttributes(this.current);

		if (result instanceof Error) {
			this._error(result.message, this.current);
		} else {
			this.setNodeData(this.current);

			result = typeof this.current.parse === 'function' ? this.current.parse(this, TEN) : true;

			if (result && result.constructor === Error) {
				this._error(result.message, this.current);
			} else {
				this.current.parent.code += this.compileNode(this.current);
			}
		}
	} else {
		this._error('Unknown tag.', this.current);
	}

	this.echo = this.beforeEcho;
	delete this.beforeEcho;
};

/**
 * @private
 */
Template.prototype.fixText = function (text) {
	var tabSize,
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
		.replace(/\u2029/g, '\\u2029')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, '\'');
};

/**
 * @private
 */
Template.prototype.fixAttributes = function (node) {
	var API = nodeAPI[node.name],
		entityRegExp = new RegExp('&' + this.config.namespace + '\\.([a-z0-9\\-_\\.]+);', 'gi'),
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

				if (attrDefinition.hasOwnProperty('type')) {
					if (entityRegExp.test(attrValue)) {
						attributes[name] = ('"' + attrValue + '"')
							.replace(new RegExp(entityRegExp.source, 'gi'), '"+$1+"')
							.replace(/^""\+/, '')
							.replace(/\+""$/, '');
					} else {
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
					}
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

/**
 * @private
 */
Template.prototype.compileNode = function (node) {
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
							node.code += ');' +
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

/**
 * @private
 */
Template.prototype.setNodeData = function (node) {
	var content = (this.xmlDeclaration + this.content).substr(0, node.index + this.xmlDeclaration.length) + node.source;

	node.line = content.split(/(?:\r\n)|\r|\n/).length;
	node.char = content
		.substring(Math.max(content.lastIndexOf('\n'), content.lastIndexOf('\r')))
		.lastIndexOf(node.source.replace(/^\s+/, ''));
};

/**
 * @private
 */
Template.prototype._error = function (message, node) {
	var error = new Error(message);

	this.setNodeData(node);

	error.nodeName = node.name;
	error.line = node.line;
	error.char = node.char;

	this.onError(error);
};

module.exports = Template;

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
 * @name template.path
 * @type string
 * @description Абсолютный путь, по которому был скомпилирован шаблон, если он был скомпилирован из файла. Это свойство доступно после наступления события {@link TEN#event:compileEnd}.
 */