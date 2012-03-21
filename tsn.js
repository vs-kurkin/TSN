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
};

var nodeAPI;
var configPath = LIB.path.join(__dirname, 'config.json');
var inlineTemplates = {};

/**
 * @ignore
 */
function getErrorData(index, result, content, declaration) {
	var error = new Error();
	var n, r;

	content = (declaration + content).substr(0, index + declaration.length) + result;

	n = content.lastIndexOf('\n');
	r = content.lastIndexOf('\r');

	error.line = content.replace((n > r) ? /[^\n]+/g : /[^\r]+/g, '').length + 1;
	error.char = content.substring(Math.max(n, r)).lastIndexOf(result.replace(/^\s+/, ''));

	return error;
}

/**
 * @ignore
 */
function normalize(node) {
	var children = node.children;
	var undefined = void 0;
	var newChildren = [];
	var child, oldType, type;

	while ((child = children.shift()) != undefined) {
		type = typeof child;

		if (child !== '') {
			if (type == 'string' && oldType == 'string') {
				newChildren.push((newChildren.pop() || '') + child);
			} else {
				child.index = newChildren.length;
				newChildren.push(child);
			}

			oldType = type;
		}
	}

	node.children.push.apply(node.children, newChildren);
}

function fixIndent(text, stack) {
	var stackLength = stack.length;
	var tabSize, spaceSize;

	if (stackLength) {
		tabSize = stackLength * (TSN.config.indent / TSN.config.tabSize);
		spaceSize = stackLength * TSN.config.indent;

		return text.replace(new RegExp('((?:\\r\\n)|\\r|\\n)[\\t]{' + tabSize + '}|[ ]{' + spaceSize + '}', 'g'), '$1');
	} else {
		return text;
	}
}

/**
 * @name TSN
 * @constructor
 * @description Конструктор создания шаблонов.
 * @param {String} data Относительный путь к файлу шаблона или код шаблона. Полный путь выглядет как <i>config.templateRoot</i> ({@link TSN#config}) + '/' + <i>data</i>.
 * @return {Object} Объект шаблона.
 */
function TSN(data) {
	if (!(this instanceof TSN)) {
		throw 'TSN should be called as a constructor';
	}

	if (TSN.config.hasOwnProperty('namespace') && (/[a-z\d\-_]+/i).test(TSN.config.namespace)) {
		this.namespace = TSN.config.namespace;
	} else {
		TSN.emit('error', new Error('Invalid namespace.'));
		this.namespace = 'tsn';
	}

	if (typeof TSN.config.tabSize != 'number' || TSN.config.tabSize < 1) {
		TSN.emit('error', new Error('Invalid tab size.'));
		TSN.config.tabSize = 2;
	} else {
		TSN.config.tabSize = Number(TSN.config.tabSize.toFixed(0));
	}

	if (typeof TSN.config.indent != 'number' || TSN.config.indent < 1) {
		TSN.emit('error', new Error('Invalid indent.'));
		TSN.config.indent = 2;
	} else {
		TSN.config.indent = Number(TSN.config.indent.toFixed(0));
	}

	var content, match, newNode, result, comment, entityTagName, entityAttrValue, closeNodeName, openNodeName, attributes, emptyNode, index, parseResult, error, newNodeAPI, parent, xmlDeclaration, attribute, attrValue;

	var current = this;
	var instance = this;
	var stack = [];
	var lastIndex = 0;

	var space = '(?:(?:(?:\\r\\n)|\\r|\\n)[^\\S\\r\\n]*)?';
	var entity = '&' + this.namespace + '.([a-z\\-_]+)(?:.([a-z\\-_\\.]+))?;';

	var regExpNode = new RegExp('(?:' + space + entity + ')|(' + space + '<!--[\\s\\S]*?-->)|(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)|(?:' + space + '<\\/\\s*' + this.namespace + ':([a-z\\-_]+)\\s*>)|(?:' + space + '<\\s*' + this.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:"[^"]*")|(?:\'[^\']*\')))*)\\s*(\\/)?>)', 'gi');
	var regExpEntity = new RegExp(entity, 'gi');
	var regExpAttr = /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:"([^"]*)")|(?:'[^']*')))?/gi;
	var regExpXML = /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*(<!DOCTYPE\s+[a-z\-_]+(?::[a-z\-_]+)?(?:\s+PUBLIC\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:\[[\s\S]*?\])?)?\s*>)?/i;

	if (typeof data.toString == 'function') {
		data = data.toString();
	}

	if (typeof data != 'string') {
		throw 'Invalid data type';
	}

	this.children = [];
	this.cache = {};

	try {
		var fullPath = LIB.path.join(TSN.config.templateRoot, data);

		if (TSN.cache.hasOwnProperty(fullPath)) {
			return TSN.cache[fullPath];
		}

		LIB.fileSystem.realpathSync(fullPath);

		content = LIB.fileSystem.readFileSync(fullPath, TSN.config.encoding);

		this.path = fullPath;
		this.pathRoot = TSN.config.templateRoot;
		TSN.cache[fullPath] = this;
	} catch (e) {
		content = data;
	}

	for (var nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('init')) {
			nodeAPI[nodeName].init(this);
		}
	}

	xmlDeclaration = content.match(regExpXML);
	if (xmlDeclaration) {
		xmlDeclaration = xmlDeclaration[0];
		content = content.substring(xmlDeclaration.length);
	} else {
		xmlDeclaration = '';
	}

	while (match = regExpNode.exec(content)) {
		result = match[0];
		entityTagName = match[1];
		entityAttrValue = match[2];
		comment = match[3];
		closeNodeName = match[4];
		openNodeName = match[5];
		attributes = match[6];
		emptyNode = match[7];
		index = match.index;

		current.children.push(fixIndent(content.substring(lastIndex, index), stack));

		if (entityTagName) {
			openNodeName = entityTagName.toLowerCase();
			emptyNode = true;
			attributes = {};

			if (nodeAPI.hasOwnProperty(openNodeName)) {
				if (entityAttrValue) {
					newNodeAPI = nodeAPI[openNodeName];

					if (newNodeAPI.hasOwnProperty('entity')) {
						if (newNodeAPI.entity.hasOwnProperty('attribute')) {
							attributes[newNodeAPI.entity.attribute] = entityAttrValue;
						} else {
							error = getErrorData(index, result, content, xmlDeclaration);
							error.message = 'Attribute name in entity declaration is not defined.';
							error.nodeName = openNodeName;
							error.template = this.path;

							TSN.emit('error', error);
						}
					} else {
						error = getErrorData(index, result, content, xmlDeclaration);
						error.message = 'Entity declaration is not defined.';
						error.nodeName = openNodeName;
						error.template = this.path;

						TSN.emit('error', error);
					}
				}
			} else {
				error = getErrorData(index, result, content, xmlDeclaration);
				error.message = 'Unknown tag.';
				error.nodeName = openNodeName;
				error.template = this.path;

				TSN.emit('error', error);
			}
		}

		if (openNodeName) {
			openNodeName = openNodeName.toLowerCase();

			if (nodeAPI.hasOwnProperty(openNodeName)) {
				newNodeAPI = nodeAPI[openNodeName];
				newNode = {
					name: openNodeName,
					attribute: {},
					'in': newNodeAPI['in'],
					out: newNodeAPI.out,
					children: []
				};

				if (typeof attributes == 'string') {
					while (attribute = regExpAttr.exec(attributes)) {
						attrValue = attribute[2];

						if (regExpEntity.test(attrValue)) {
							var parentTemplate = TSN.prototype.parent;
							TSN.prototype.parent = instance;

							if (inlineTemplates.hasOwnProperty(attrValue)) {
								attrValue = inlineTemplates[attrValue];
							} else {
								attrValue = inlineTemplates[attrValue] = new TSN(attrValue);
							}

							TSN.prototype.parent = parentTemplate;
							attrValue.parent = instance;
							attrValue.toString = attrValue.render;
						}

						newNode.attribute[attribute[1]] = attrValue;
					}
				} else if (attributes) {
					newNode.attribute = attributes;
				}

				if (emptyNode) {
					parseResult = typeof newNodeAPI.parse == 'function' ? newNodeAPI.parse.call(newNode, this) : true;

					if (typeof parseResult == 'string') {
						current.children.push(parseResult);
					} else if (parseResult && parseResult.constructor == Error) {
						error = getErrorData(index, result, content, xmlDeclaration);
						error.message = parseResult.message;
						error.nodeName = openNodeName;
						error.template = this.path;

						TSN.emit('error', error);
					} else {
						current.children.push(newNode);
					}
				} else {
					stack.push(current);
					newNode.start = index;
					newNode.result = result;
					current = newNode;
				}
			} else {
				error = getErrorData(index, result, content, xmlDeclaration);
				error.message = emptyNode ? 'Unknown empty tag.' : 'Unknown tag opening.';
				error.nodeName = openNodeName;
				error.template = this.path;

				TSN.emit('error', error);
			}

		} else if (closeNodeName) {
			closeNodeName = closeNodeName.toLowerCase();

			if (nodeAPI.hasOwnProperty(closeNodeName)) {
				if (current.name != closeNodeName) {
					parent = stack.pop();

					if (parent && closeNodeName == parent.name) {
						error = getErrorData(current.start, current.result, content, xmlDeclaration);
						error.message = 'Tag is not closed.';
						error.nodeName = current.name;
						error.template = this.path;

						TSN.emit('error', error);

						parent.children.push.apply(parent.children, current.children);
						current = parent;
					} else {
						error = getErrorData(index, result, content, xmlDeclaration);
						error.message = 'Closing tag matches nothing.';
						error.nodeName = closeNodeName;
						error.template = this.path;

						TSN.emit('error', error);

						parent && stack.push(parent);
						lastIndex = index + result.length;
						continue;
					}
				}

				parent = stack.pop();

				if (current.children.length) {
					normalize(current);
				}

				newNodeAPI = nodeAPI[current.name];
				parseResult = typeof newNodeAPI.parse == 'function' ? newNodeAPI.parse.call(current, this) : true;

				if (typeof parseResult == 'string') {
					parent.children.push(parseResult);
				} else if (parseResult && parseResult.constructor == Error) {
					error = getErrorData(current.start, current.result, content, xmlDeclaration);
					error.message = parseResult.message;
					error.nodeName = openNodeName;
					error.template = this.path;

					TSN.emit('error', error);
				} else {
					parent.children.push(current);
				}

				delete current.start;
				delete current.result;

				current = parent;
			} else {
				error = getErrorData(index, result, content, xmlDeclaration);
				error.message = 'Unknown tag closing.';
				error.nodeName = closeNodeName;
				error.template = this.path;

				TSN.emit('error', error);
			}

		} else if (comment) {
			if (TSN.config.saveComments === true) {
				current.children.push(fixIndent(result, stack));
			}
		} else { // CDATA
			current.children.push(result);
		}

		lastIndex = index + result.length;
	}

	delete this.cache;

	this.children.push(fixIndent(content.substring(lastIndex), stack));

	normalize(this);

	do {
		if (current != this) {
			error = getErrorData(current.start, current.result, content, xmlDeclaration);
			error.message = 'Tag is not closed.';
			error.nodeName = current.name;
			error.template = this.path;

			delete current.start;
			delete current.result;

			TSN.emit('error', error);
		}
	} while (current = stack.pop());

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
		nodeAPI[name] = data;
	}
};

/**
 * Рендеринг шаблона на основе переданных данных.
 * @param {Object} data Объект данных, на основе которых генерируется результат.
 * @return {String} Результат рендеринга.
 * @function
 */
TSN.prototype.render = function (data) {
	var isParse, parent;
	var currentNode = this;
	var currentIndex = 0;
	var currentChild = currentNode.children[currentIndex];
	var result = '';
	var stack = [];
	var contexts = [];

	if (this.hasOwnProperty('parent')) {
		data = this.parent.context;
	}

	this.data = this.context = data;
	this.cache = {};

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
					if (typeof currentChild.out == 'function') {
						currentChild.out(this);
					}

					currentNode.text += currentChild.text;
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

			if (typeof currentNode.out == 'function') {
				currentNode.out(this);
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
	delete this.cache;

	return result;
};

/**
 * Повторный парсинг шаблона, загруженного из файла.
 * @param {String} [newPath] Новый путь к файлу шаблона.
 * @return {Object} Объект шаблона.
 * @function
 */
TSN.prototype.reload = function (newPath) {
	delete TSN.cache[this.path];
	return TSN.call(this, typeof newPath == 'string' ? newPath : this.path.substr(this.pathRoot.length));
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

	nodeAPI = require(LIB.path.join(__dirname, 'tags.js'));

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