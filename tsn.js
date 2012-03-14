/**
 * @fileOverview Templateting System for Node.JS.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.1 beta
 */

/**
 * @ignore
 */
var LIB = {
	fileSystem: require('fs'),
	path: require('path'),
	event: require('events')
},
	configPath = LIB.path.join(__dirname, 'config.json'),
	tag,
	currentTmplChild,
	currentTemplate,
	regExpTag;

/**
 * @ignore
 * todo: Доделать информацию о ошибках парсинга
 */
var createError = (function () {
	var regExpN = /[^\n]+/g;
	var regExpR = /[^\r]+/g;

	return function (index, result, content, declaration) {
		var n,
			r,
			error = new Error();

		content = (declaration + content).substr(0, index + declaration.length) + result;

		n = content.lastIndexOf('\n');
		r = content.lastIndexOf('\r');

		error.line = content.replace((n > r) ? regExpN : regExpR, '').length + 1;
		error.char = content.substring((n > r) ? n : r).lastIndexOf(result.replace(/^\s+/, ''));

		return error;
	};
})();

/**
 * @ignore
 */
function normalize (node) {
	var children = node.children,
		child,
		oldType,
		type,
		newChildren = [];

	while ((child = children.shift()) != undefined) {
		type = typeof child;

		if (child !== '') {
			if (type == 'string' && type == oldType) {
				newChildren.push((newChildren.pop() || '') + child);
			} else {
				child.index = newChildren.length;
				newChildren.push(child);
			}
		}

		oldType = type;
	}

	node.children.push.apply(node.children, newChildren);
}

/**
 * @ignore
 */
function toString() {
	if (this.hasOwnProperty('name')) {
		return this.template['var'][this.name];
	} else {
		var length = this.length,
			vars = this.template['var'],
			value = this.value,
			result = value[--length];

		while (length) {
			result = vars[value[--length]] + result;
			result = value[--length] + result;
		}

		return result;
	}
}

/**
 * @ignore
 */
function parseAttribute(result, name, value) {
	var match,
		index,
		lastIndex = 0,
		attribute,
		data = [];

	while (match = regExpTag.exec(value)) {
		index = match.index;
		data.push(value.slice(lastIndex, index), match[1]);
		lastIndex = index + match[0].length;
	}

	if (lastIndex) {
		data.push(value.slice(lastIndex));
		if (data.length == 3 && data[0] == '' && data[2] == '') {
			attribute = {
				name: data[1],
				toString: toString,
				template: currentTemplate
			};
		} else {
			attribute = {
				value: data,
				toString: toString,
				length: data.length,
				template: currentTemplate
			};
		}
	} else {
		attribute = value;
	}

	currentTmplChild.attribute[name] = attribute;
}

/**
 * @name TSN
 * @constructor
 * @description Конструктор создания шаблонов.
 * @param {String} path Относительный путь к файлу шаблона или код шаблона. Полный путь выглядет как <i>config.templateRoot</i> ({@link TSN#config}) + '/' + <i>path</i>.
 * @param {Boolean} [isInline] Флаг, указывающий на то что, в параметре path передан код шаблона.
 * @return {Object} Объект шаблона.
 */
function TSN(path, isInline) {
	if (!(this instanceof TSN)) {
		throw 'TSN should be called as a constructor';
	}

	if (typeof path.toString == 'function') {
		path = path.toString();
	}

	if (typeof path != 'string') {
		throw 'Invalid path type';
	}

	if (TSN.config.hasOwnProperty('namespace') && (/[a-z0-9-_]+/i).test(TSN.config.namespace)) {
		this.namespace = TSN.config.namespace;
	} else {
		TSN.emit('error', new Error('Invalid namespace.'));
	}

	this.errors = [];
	this.children = [];
	this.temp = {};
	this.cache = {};

	LIB.fileSystem.realpathSync(TSN.config.templateRoot);

	fullPath = LIB.path.join(TSN.config.templateRoot, path);
	if (TSN.cache.hasOwnProperty(fullPath)) {
		return TSN.cache[fullPath];
	}

	var content;
	if (isInline !== true) {
		content = LIB.fileSystem.readFileSync(fullPath, TSN.config.encoding);

		this.path = fullPath;
	} else {
		content = path;
	}

	var space = '(?:\\r|\\n[^\\S\\r\\n]*)?',
		entity = '&' + this.namespace + '.([a-z0-9]+);',
		tagStart = '(?:' + space + entity + ')|(' + space + '<!--[\\s\\S]*?-->)|(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)|(?:' + space + '<\\/\\s*' + this.namespace + ':([a-z\\-_]+)\\s*>)',
		regExp = {
			tag: new RegExp(tagStart + '|(?:' + space + '<\\s*' + this.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:"[^"]*")|(?:\'[^\']*\')))*)\\s*(\\/)?>)', 'gi'),
			attr: /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:"([^"]*)")|(?:'[^']*')))?/gi,
			xml: /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*(<!DOCTYPE\s+[a-z\-_]+(?::[a-z\-_]+)?(?:\s+PUBLIC\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:\[[\s\S]*?\])?)?\s*>)?/i,
			entity: new RegExp(entity, 'gi')
		},
		match,
		current = this,
		node,
		stack = [],
		xmlDeclaration = '',
		result,
		comment,
		value,
		closeTagName,
		openTagName,
		attributes,
		emptyTag,
		index,
		lastIndex = 0,
		fullPath,
		parseResult,
		error,
		onParse;

	TSN.cache[fullPath] = this;

	content = content.replace(regExp.xml, function (result) {
		xmlDeclaration = result;
		return '';
	});

	while (match = regExp.tag.exec(content)) {
		result = match[0];
		value = match[1];
		comment = match[2];
		closeTagName = match[3];
		openTagName = match[4];
		attributes = match[5];
		emptyTag = match[6];
		index = match.index;

		current.children.push(content.substring(lastIndex, index));

		if (value) {
			openTagName = 'echo';
			emptyTag = true;
			attributes = {
				data: value
			};
		}

		if (openTagName) {
			if (tag.hasOwnProperty(openTagName)) {
				node = {
					name: openTagName,
					attribute: {},
					start: index,
					'in': tag[openTagName]['in'],
					out: tag[openTagName].out,
					children: [],
					root: this
				};

				if (typeof attributes == 'string') {
					currentTmplChild = node;
					currentTemplate = this;
					regExpTag = regExp.entity;
					attributes.replace(regExp.attr, parseAttribute);
				} else if (attributes) {
					node.attribute = attributes;
				}

				onParse = tag[openTagName].parse;
				parseResult = typeof onParse == 'function' ? onParse.call(node, this) : true;

				if (typeof parseResult == 'string') {
					current.children.push(parseResult);
				} else if (parseResult && parseResult.constructor == Error) {
					error = createError(index, result, content, xmlDeclaration);
					error.message = parseResult.message;
					error.tagName = openTagName;

					this.errors.push(error);
				} else {
					current.children.push(node);
				}

				if (emptyTag) {
					delete node.start;
				} else {
					stack.push(current);
					current = node;
				}
			} else {
				error = createError(index, result, content, xmlDeclaration);
				error.message = emptyTag ? 'Unknown tag.' : 'Unknown tag opening.';
				error.tagName = openTagName;

				this.errors.push(error);
			}

		} else if (closeTagName) {
			if (tag.hasOwnProperty(closeTagName)) {
				if (current.name == closeTagName) {
					delete current.start;

					if (current.hasOwnProperty('children') && current.children.length) {
						normalize(current);
					}

					current = stack.pop();
				} else {
					error = createError(index, result, content, xmlDeclaration);
					error.message = 'Missing start tag.';
					error.tagName = closeTagName;

					this.errors.push(error);
				}
			} else {
				error = createError(index, result, content, xmlDeclaration);
				error.message = 'Unknown tag closing.';
				error.tagName = closeTagName;

				this.errors.push(error);
			}

		} else if (comment) {
			if (TSN.config.saveComments === true) {
				current.children.push(result);
			}
		} else { // CDATA
			current.children.push(result);
		}

		lastIndex = index + result.length;
	}

	delete this.temp;

	while (current = stack.pop()) {
		error = createError(index, result, content, xmlDeclaration);
		error.message = 'Tag is not closed.';
		error.tagName = current.name;

		this.errors.push(error);

		delete current.start;
	}

	this.children.push(content.substring(lastIndex));

	normalize(this);

	currentTemplate = currentTmplChild = regExpTag = null;

	return this;
}

/**
 * @ignore
 */
var eventPrototype = LIB.event.EventEmitter.prototype;
for (var property in eventPrototype) {
	if (eventPrototype.hasOwnProperty(property)) {
		TSN[property] = eventPrototype[property];
	}
}

/**
 * Стандартные настройки шаблонизатора.
 * @static
 */
TSN.config = {};

/**
 * Кеш. Содержит все созданные объекты шаблона, загруженные из файла.
 * Именами свойств являются полные пути к соответствующим шаблонам.
 * @static
 */
TSN.cache = {};

/**
 * Метод расширения набора тегов шаблонизатора.
 * @static
 * @param {String} name Локальное имя тега.
 * @param {Object} data Объектное описание тега.
 */
TSN.extend = function (name, data) {
	if (typeof name == 'string' && data && (typeof data['in'] == 'function' || typeof data['out'] == 'function')) {
		tag[name] = data;
	}
};

/**
 * Рендеринг шаблона на основе переданных данных.
 * @param {Object} data Объект данных, на основе которых генерируется результат.
 * @return {String} Результат рендеринга.
 * @function
 */
TSN.prototype.render = function (data) {
	var currentNode = this,
		currentIndex = 0,
		currentChild = currentNode.children[currentIndex],
		result = '',
		isParse,
		tagName,
		parent,
		stack = [],
		contexts = [];

	this.data = this.context = data;
	this.temp = this.cache;

	currentNode.text = '';

	while (true) {
		if (currentChild) {
			if (typeof currentChild == 'string') {
				currentNode.text += currentChild;
				currentChild = currentNode.children[++currentIndex];
			} else {
				currentChild.text = '';

				switch (typeof currentChild['in']) {
					case 'boolean':
						isParse = currentChild['in'];
						break;
					case 'function':
						isParse = currentChild['in'](this);
						break;
					default:
						isParse = true;
				}

				if (isParse === false) {
					if (typeof currentChild['out'] == 'function') {
						currentChild['out'](this);
					}

					currentNode.text += currentChild.text || '';
					delete currentChild.text;

					currentIndex = currentChild.index + 1;
					currentChild = currentNode.children[currentIndex];
				} else {
					contexts.push(this.context);
					stack.push(currentNode);

					if (currentChild.attribute.hasOwnProperty('context')) {
						this.context = this.context[currentChild.attribute.context];
					}

					currentChild.text = '';
					currentNode = currentChild;
					currentIndex = 0;
					currentChild = currentNode.children[currentIndex];
				}
			}


		} else {
			if (currentNode == this) {
				result = currentNode.text;
				delete currentNode.text;
				break;
			}

			parent = stack.pop();

			if (typeof currentNode['out'] == 'function') {
				currentNode['out'](this);
			}

			this.context = contexts.pop();

			parent.text += currentNode.text;
			delete currentNode.text;

			currentIndex = currentNode.index + 1;
			currentChild = parent.children[currentIndex];
			currentNode = parent;
		}
	}

	delete this.data;
	delete this.context;
	delete this.temp;

	return result;
};

/**
 * Повторный парсинг шаблона, загруженного из файла.
 * @param {String} [newPath] Новый оносительный пути к файлу шаблона.
 * @return {Object} Объект шаблона или ошибку доступа к файлу.
 * @function
 */
TSN.prototype.reload = function (newPath) {
	delete TSN.cache[this.path];
	return TSN.call(this, typeof newPath == 'string' ? newPath : this.path.substr(TSN.config.templateRoot.length), false);
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

	tag = require(LIB.path.join(__dirname, 'tags.js'));

	TSN.emit('ready');
});

TSN.on('ready', function () {
	function dataFromContext(instance) {
		this.text = instance.context[this.aData];
		return false;
	}

	function fromVar(instance) {
		this.text = instance.temp['var'][this.aVar];
		return false;
	}

	TSN.extend('echo', {
		parse: function () {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('data')) {
				this.aData = attribute.data;
				this['in'] = dataFromContext;
			} else if (attribute.hasOwnProperty('var')) {
				this.aVar = attribute['var'];
				this['in'] = fromVar;
			}

			this.children.length = 0;
		},
		'in': function (instance) {
			this.text = instance.context;
			return false;
		},
		entity: {
			attribute: ''
		}
	});
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
 * @description Ошибка инициализации модуля.
 */