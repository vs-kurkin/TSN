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
	nodeAPI,
	inlineTemplates = {};

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
		newChildren = [],
		undefined = void 0;

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

	var content,
		space = '(?:\\r|\\n[^\\S\\r\\n]*)?',
		entity = '&' + this.namespace + '.([a-z\\-_]+)(?:.([a-z\\-_\\.]+))?;',
		nodeStart = '(?:' + space + entity + ')|(' + space + '<!--[\\s\\S]*?-->)|(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)|(?:' + space + '<\\/\\s*' + this.namespace + ':([a-z\\-_]+)\\s*>)',
		regExp = {
			node: new RegExp(nodeStart + '|(?:' + space + '<\\s*' + this.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:"[^"]*")|(?:\'[^\']*\')))*)\\s*(\\/)?>)', 'gi'),
			attr: /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:"([^"]*)")|(?:'[^']*')))?/gi,
			xml: /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*(<!DOCTYPE\s+[a-z\-_]+(?::[a-z\-_]+)?(?:\s+PUBLIC\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:\[[\s\S]*?\])?)?\s*>)?/i,
			entity: new RegExp(entity, 'gi')
		},
		match,
		current = this,
		instance = this,
		newNode,
		stack = [],
		xmlDeclaration = '',
		result,
		comment,
		entityTagName,
		entityAttrValue,
		closeNodeName,
		openNodeName,
		attributes,
		emptyNode,
		index,
		lastIndex = 0,
		parseResult,
		error,
		newNodeAPI;

	if (typeof data.toString == 'function') {
		data = data.toString();
	}

	if (typeof data != 'string') {
		throw 'Invalid data type';
	}

	this.children = [];
	this.cache = {};

	try {
		var fullPath = LIB.path.join(TSN.config.pathRoot, data);

		if (TSN.cache.hasOwnProperty(fullPath)) {
			return TSN.cache[fullPath];
		}

		LIB.fileSystem.realpathSync(fullPath);

		content = LIB.fileSystem.readFileSync(fullPath, TSN.config.encoding);

		this.path = fullPath;
		this.pathRoot = TSN.config.pathRoot;
		TSN.cache[fullPath] = this;
	} catch (e) {
		content = data;
	}

	for (var nodeName in nodeAPI) {
		if (nodeAPI.hasOwnProperty(nodeName) && nodeAPI[nodeName].hasOwnProperty('init')) {
			nodeAPI[nodeName].init(this);
		}
	}

	content = content.replace(regExp.xml, function (result) {
		xmlDeclaration = result;
		return '';
	});

	while (match = regExp.node.exec(content)) {
		result = match[0];
		entityTagName = match[1];
		entityAttrValue = match[2];
		comment = match[3];
		closeNodeName = match[4];
		openNodeName = match[5];
		attributes = match[6];
		emptyNode = match[7];
		index = match.index;

		current.children.push(content.substring(lastIndex, index));

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
							error = createError(index, result, content, xmlDeclaration);
							error.message = 'Attribute name in entity declaration is not defined.';
							error.nodeName = openNodeName;
							error.template = this.path;

							TSN.emit('error', error);
						}
					} else {
						error = createError(index, result, content, xmlDeclaration);
						error.message = 'Entity declaration is not defined.';
						error.nodeName = openNodeName;
						error.template = this.path;

						TSN.emit('error', error);
					}
				}
			} else {
				error = createError(index, result, content, xmlDeclaration);
				error.message = 'Unknown node.';
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
					start: index,
					'in': newNodeAPI['in'],
					out: newNodeAPI.out,
					children: []
				};

				if (typeof attributes == 'string') {
					attributes.replace(regExp.attr, function (result, name, value) {
						if (regExp.entity.test(value)) {
							if (inlineTemplates.hasOwnProperty(value)) {
								value = inlineTemplates[value];
							} else {
								value = inlineTemplates[value] = new TSN(value);
							}
							value.parent = instance;
							value.toString = value.render;
						}

						newNode.attribute[name] = value;
					});
				} else if (attributes) {
					newNode.attribute = attributes;
				}

				parseResult = typeof newNodeAPI.parse == 'function' ? newNodeAPI.parse.call(newNode, this) : true;

				if (typeof parseResult == 'string') {
					current.children.push(parseResult);
				} else if (parseResult && parseResult.constructor == Error) {
					error = createError(index, result, content, xmlDeclaration);
					error.message = parseResult.message;
					error.nodeName = openNodeName;
					error.template = this.path;

					TSN.emit('error', error);
				} else {
					current.children.push(newNode);
				}

				if (emptyNode) {
					delete newNode.start;
				} else {
					stack.push(current);
					current = newNode;
				}
			} else {
				error = createError(index, result, content, xmlDeclaration);
				error.message = emptyNode ? 'Unknown node.' : 'Unknown node opening.';
				error.nodeName = openNodeName;
				error.template = this.path;

				TSN.emit('error', error);
			}

		} else if (closeNodeName) {
			closeNodeName = closeNodeName.toLowerCase();

			if (nodeAPI.hasOwnProperty(closeNodeName)) {
				if (current.name == closeNodeName) {
					delete current.start;

					if (current.hasOwnProperty('children') && current.children.length) {
						normalize(current);
					}

					current = stack.pop();
				} else {
					error = createError(index, result, content, xmlDeclaration);
					error.message = 'Missing start node.';
					error.nodeName = closeNodeName;
					error.template = this.path;

					TSN.emit('error', error);
				}
			} else {
				error = createError(index, result, content, xmlDeclaration);
				error.message = 'Unknown node closing.';
				error.nodeName = closeNodeName;
				error.template = this.path;

				TSN.emit('error', error);
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

	delete this.cache;

	while (current = stack.pop()) {
		delete current.start;

		error = createError(index, result, content, xmlDeclaration);
		error.message = 'Node is not closed.';
		error.nodeName = current.name;
		error.template = this.path;

		TSN.emit('error', error);
	}

	this.children.push(content.substring(lastIndex));

	normalize(this);

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
	var currentNode = this,
		currentIndex = 0,
		currentChild = currentNode.children[currentIndex],
		result = '',
		isParse,
		parent,
		stack = [],
		contexts = [];

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