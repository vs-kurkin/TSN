/**
 * @author Влад Куркин, Email: b-vladi@cs-console.ru
 * @version 1.0 beta
 * @title Templating System Node.JS
 *
 * Dependents:
 * Стандартный модуль fs, для работы с файловой системой.
 */

var LIB = {
	fileSystem: require('fs')
};

var pathRoot = module.filename.replace(/(.*)\/.*$/, '$1/');

/**
 * Стандартные настройки шаблонизатора.
 * <b>namespace</b> - Постранство имен тегов.
 * <b>type</b> - Тип файлов шаблона. Возможные значения: xml, html.
 * <b>templatePath</b> - Полный путь к папке шаблонов без слеша на конце.
 * <b>encoding</b> - Кодировка файлов шаблона.
 * <b>parseIncluded</b> - Флаг, указывающий на необходимость парсинга шаблонов, вставленных тегом include.
 */
var defaultConfig = {
	namespace: 'tsn',
	type: 'xml',
	templatePath: '',
	encoding: 'utf-8',
	parseIncluded: true
};

var tag;

function getErrorData(result, index, text) {
	text = text.substr(0, index) + result;
	var n = text.lastIndexOf('\n');
	var r = text.lastIndexOf('\r');

	return 'Line: ' + (text.replace(/[^\n\r]+/g, '').length + 1) + ', Char: ' + text.substring((n > r) ? n : r)
		.lastIndexOf(result.replace(/^\s+/, ''));
}

/**
 * Конструктор создания шаблонов.
 * @constructor
 * @param path {String} Относительный путь к файлу шаблона или код шаблона. Полный путь выглядет как config.templatePath + '/' + path.
 * @param isInline {Boolean} Флаг, указывающий на то что, в параметре @param path передан код шаблона.
 * @trows <i>Invalid path type</i> - Ошибка, возникающая в том случае, если параметр @param path не соответствует типу String.
 * @return {Object} Возвращает объект шаблона.
 */
module.exports = function(path, isInline) {
	var tagStart = '(?:&' + TSN.config
		.namespace + '.([a-z0-9-_]+);)|(?:<!--[\\s\\S]*?-->)|(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)|(?:(?:\\r|\\n[^\\S\\r\\n]*)?<\\/\\s*' + TSN
		.config.namespace + ':([a-z\\-_]+)\\s*>)',
		regExp = {
			tagHTML: tagStart + '|(?:(?:\\r|\\n[^\\S\\r\\n]*)?<\\s*' + TSN.config
				.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*(?:=\\s*(?:(?:"[^"]*")|(?:\'[^\']*\')|(?:[^\\s]+)))?)*)\\s*(\\/)?>)',
			tagXML: tagStart + '|(?:(?:\\r|\\n[^\\S\\r\\n]*)?<\\s*' + TSN.config
				.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:"[^"]*")|(?:\'[^\']*\')))*)\\s*(\\/)?>)',
			attrs: /\s*([a-z\-_]+)\s*(?:=\s*(?:(?:"([^"]*)")|(?:'[^']*')))?/gi,
			xml: /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*/i
		},
		match,
		cRegExp,
		current,
		node,
		stack = [],
		resultLength = 0,
		isXML = false,
		result,
		currentResultLength,
		value,
		closeTagName,
		openTagName,
		attributes,
		emptyTag,
		index,
		lastIndex = 0,
		attr,
		fullPath;

	if (typeof path != 'string') {
		throw new Error('Invalid path type');
	}

	fullPath = TSN.config.templatePath + '/' + path;
	if (TSN.cache.hasOwnProperty(fullPath)) {
		return TSN.cache[fullPath];
	}

	if (!(this instanceof TSN)) {
		return new TSN(path, isInline);
	}

	this.errors = [];

	if (isInline !== true) {
		try {
			path = LIB.fileSystem.readFileSync(fullPath, TSN.config.encoding);
		} catch (error) {
			return error;
		}

		this.path = fullPath;
	}

	this.children = [];
	this.text = '';
	this.namespace = TSN.config.namespace;

	TSN.cache[fullPath] = current = this;

	path = path.replace(regExp.xml, function (result) {
		isXML = result;
		return '';
	});

	cRegExp = new RegExp((isXML === false && TSN.config.type == 'html') ? regExp.tagHTML : regExp.tagXML, 'gi');

	isXML = isXML || '';
	while (match = cRegExp.exec(path)) {
		result = match[0];
		currentResultLength = result.length;
		value = match[1];
		closeTagName = match[2];
		openTagName = match[3];
		attributes = match[4];
		emptyTag = match[5];
		index = match.index;

		this.text += path.substring(lastIndex, index);

		if (value) {
			node = {
				name: 'echo',
				attribute: {
					'expr': value
				},
				start: index - resultLength,
				end: index - resultLength,
				index: current.children.length
			};

			current.children.push(node);

			resultLength += currentResultLength;
		} else if (openTagName) {
			if (tag.hasOwnProperty(openTagName)) {
				node = {
					name: openTagName,
					attribute: {},
					start: index - resultLength,
					index: current.children.length
				};

				current.children.push(node);

				if (emptyTag) {
					node.end = node.start;
				} else {
					node.children = [];
					stack.push(current);
					current = node;
				}

				if (attributes) {
					while (attr = regExp.attrs.exec(attributes)) {
						node.attribute[attr[1]] = attr[2];
					}
				}

				if (tag[openTagName].hasOwnProperty('parse') && typeof tag[openTagName].parse == 'function') {
					tag[openTagName].parse.call(this, node);
				}
			} else {
				this.errors
					.push('Unknown name tag opening \'' + openTagName + '\'\n' + getErrorData(isXML + result, index, path));
			}

			resultLength += currentResultLength;
		} else if (closeTagName) {
			if (tag.hasOwnProperty(closeTagName)) {
				if (current.name == closeTagName) {
					if (!current.children.length) {
						delete current.children;
					}

					current.end = index - resultLength;
					current = stack.pop();
				} else {
					this.errors.push('Missing start tag \'' + closeTagName + '\'\n' + getErrorData(isXML + result, index, path));
				}
			} else {
				this.errors
					.push('Unknown name tag closing \'' + closeTagName + '\'\n' + getErrorData(isXML + result, index, path));
			}

			resultLength += currentResultLength;
		} else {
			this.text += result;
		}

		lastIndex = index + currentResultLength;
	}

	var tagData;
	while (tagData = stack.pop()) {
		tagData.end = tagData.start;
		this.errors.push('Tag is not closed \'' + tagData.name + '\'\n' + getErrorData(isXML + result, tagData
			.start, path));
	}

	this.text += path.substring(lastIndex);
};

var TSN = module.exports;

/**
 * Кеш. Содержит все созданные объекты шаблона, загруженные из файла.
 * Именами свойств являются полные пути к соответствующим шаблонам.
 */
TSN.cache = {};

/**
 * Метод расширения набора тегов шаблонизатора.
 * @param name {String} Локальное имя тега.
 * @param data {Object} Объектное описание тега.
 */
TSN.extend = function(name, data) {
	if (typeof name == 'string' && data && (typeof data['in'] == 'function' || typeof data['out'] == 'function')) {
		tag[name] = data;
	}
};

TSN.load = function(path) {

};

TSN.prototype.toString = function() {
	return '{"text":"' + this.text.replace(/"/g, '\\\\"').replace(/\n/g, '\\\\n').replace(/\r/g, '\\\\r') + '",' + '"children":' + JSON.stringify(this.children) + '}';
};

/**
 * Выполняет переданное выражение из шаблона. Используется в объектах описания тега.
 * @param expr {String} JavaScript - выражение.
 * @this {Object} Объект шаблона.
 * @return Резальтат выполнения выражения или ошибку.
 */
TSN.prototype.expression = (function() {
	var current;

	function replaceEntity(result, property) {
		var value = current['var'][property];
		return value ? value.toString() : '';
	}

	return function(expr) {
		current = this;
		expr = expr.replace(new RegExp('&' + this.namespace + '.([a-z0-9]+);', 'gi'), replaceEntity);
		current = null;

		this.exprParams.splice(this.exprArgs.length, 1, 'return ' + expr);
		try {
			return Function.apply(null, this.exprParams).apply(this.data, this.exprArgs);
		} catch(e) {
			return e;
		}
	};
})();

/**
 * Рендеринг шаблона на основе переданных данных.
 * @param data {Object} Объект данных, на основе которых генерируется результат.
 * @this {Object} Объект шаблона.
 * @return {Text} Результат рендеринга.
 */
TSN.prototype.render = function(data) {
	var currentNode = this,
		currentChild = currentNode.children ? currentNode.children[0] : false,
		result = '',
		isParse,
		lastIndex = 0,
		isInline,
		templateText = this.text,
		tagData,
		tagName,
		newResult,
		listener,
		parent,
		stack = [];

	this.data = data;

	for (tagName in tag) {
		if (tag.hasOwnProperty(tagName) && typeof tag[tagName].startRender == 'function') {
			tag[tagName].startRender.call(this);
		}
	}

	this.exprArgs = [];
	this.exprParams = [];

	for (var property in data) {
		if (data.hasOwnProperty(property)) {
			this.exprArgs.push(data[property]);
			this.exprParams.push(property);
		}
	}

	currentNode.text = '';

	while (true) {
		if (currentChild) {
			isInline = currentChild.isIncluded !== true;

			if (isInline) {
				currentNode.text += templateText.slice(lastIndex, currentChild.start);
			}

			lastIndex = currentChild.start;

			isParse = true;
			listener = tag[currentChild.name]['in'];

			switch (typeof listener) {
				case 'boolean': isParse = listener;
					break;
				case 'function': isParse = listener.call(this, currentChild, stack);
					break;
			}

			if (isParse === false) {
				currentChild.text = '';
				tagData = tag[currentChild.name]['out'];
				if (typeof tagData == 'function') {
					tagData.call(this, currentChild, stack);
				}

				currentNode.text += currentChild.text;
				delete currentChild.isIncluded;
				delete currentChild.text;

				lastIndex = currentChild.end;
				currentChild = currentNode.children[currentChild.index + 1];
			} else {
				if (currentChild.hasOwnProperty('children')) {
					stack.push(currentNode);
					currentChild.text = '';
					currentNode = currentChild;
					currentChild = currentNode.children[0];
				} else {
					currentChild.text = templateText.slice(lastIndex, currentChild.end);

					lastIndex = isInline ? currentChild.end : currentNode.end;

					tagData = tag[currentChild.name]['out'];
					if (typeof tagData == 'function') {
						tagData.call(this, currentChild);
					}

					currentNode.text += currentChild.text;
					delete currentChild.isIncluded;
					delete currentChild.text;

					currentChild = currentNode.children[currentChild.index + 1];
				}
			}
		} else {
			if (currentNode == this) {
				result = currentNode.text + templateText.slice(lastIndex);
				break;
			}

			currentNode.text += templateText.slice(lastIndex, currentNode.end);

			parent = stack.pop();
			lastIndex = currentNode.isIncluded === true ? parent.end : currentNode.end;

			tagData = tag[currentNode.name]['out'];
			if (typeof tagData == 'function') {
				tagData.call(this, currentNode, stack);
			}

			parent.text += currentNode.text;
			delete currentNode.isIncluded;
			delete currentNode.text;

			currentChild = parent.children[currentNode.index + 1];
			currentNode = parent;
		}
	}

	this.text = templateText;

	delete this.exprArgs;
	delete this.exprParams;
	delete this.data;

	for (tagName in tag) {
		if (tag.hasOwnProperty(tagName) && typeof tag[tagName].endRender == 'function') {
			newResult = tag[tagName].endRender.call(this, result);
			if (typeof newResult == 'string') {
				result = newResult;
			}
		}
	}
	return result;
};

/**
 * Повторный парсинг шаблона, загруженного из файла.
 * @param newPath {String} Необязательный параметр, сответствующий новому относительному пути к файлу шаблона.
 * @this {Object}
 * @return {Object} Объект шаблона или ошибку доступа к файлу.
 */
TSN.prototype.reload = function(newPath) {
	var path = TSN.config.templatePath + '/' + (typeof newPath == 'string' ? newPath : this.path);

	try {
		path = LIB.fileSystem.realpathSync(path);
	} catch (e) {
		return e;
	}

	if (TSN.cache.hasOwnProperty(path)) {
		delete TSN.cache[path];
	}

	return TSN.call(this, newPath, false);
};

TSN.prototype.save = function(path) {
	var text = this.toString();

};

LIB.fileSystem.readFile(pathRoot + 'config.json', 'utf-8', function(err, data) {
	if (err) {
		TSN.config = defaultConfig;
	} else {
		try {
			var config = JSON.parse(data);
		} catch(e) {
			throw new Error('Format error in configuration file \'' + pathRoot + 'config.json\'');
		}

		for (var property in defaultConfig) {
			if (defaultConfig.hasOwnProperty(property) && !config.hasOwnProperty(property)) {
				config[property] = defaultConfig[property];
			}
		}

		if (typeof config.namespace != 'string' || !config.namespace.length || !(/[a-z0-9-_]+/i).test(config.namespace)) {
			config.namespace = defaultConfig.namespace;
		}

		LIB.fileSystem.realpath(config.templatePath, function(err, path) {
			config.templatePath = err ? defaultConfig.templatePath : path;
			TSN.config = config;
		});
	}
});

tag = require(pathRoot + 'tags.js');