/**
 * @fileOverview Парсер TSN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */
var regExpAttr = /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:(?:\\)?"([^"]*?)(?:\\)?")|(?:(?:\\)?'([^']*?)(?:\\)?')))?/gi;
var regExpXML = /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*(<!DOCTYPE\s+[a-z\-_]+(?::[a-z\-_]+)?(?:\s+PUBLIC\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:\[[\s\S]*?\])?)?\s*>)?/i;

/**
 * Парсер TSN-шаблона.
 * @param {object} config Объект конфигурации шаблона.
 * @constructor
 */
function Parser(config) {
	var space = '(?:(?:(?:\\r\\n)|\\r|\\n)[^\\S\\r\\n]*)?';
	var comment = space + '<!--(?!\\[if [^\\]]+?\\]>)[\\s\\S]*?(?!<!\\[endif\\])-->';
	var cdata = config.parseCDATA === true ? '' : '|(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)';

	if (!(config.namespace && (/[a-z\d\-_]+/i).test(config.namespace))) {
		this.onError(new Error('Invalid namespace.'));
		config.namespace = 'tsn';
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

	/**
	 * Объект конфигурации шаблона.
	 * @type object
	 */
	this.config = config;

	/**
	 * Регурярное выражение, которым парсится шаблон.
	 * @type regexp
	 */
	this.regExp = new RegExp('(?:' + space + '&' + config.namespace + '.([a-z0-9\\-_\\.]+)?;)|(' + comment + ')' + cdata + '|(?:' + space + '<\\/\\s*' + config.namespace + ':([a-z\\-_]+)\\s*>)|(?:' + space + '<\\s*' + config.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:(?:\\\\)?"[^"]*(?:\\\\)?")|(?:(?:\\\\)?\'[^\']*(?:\\\\)?\')))*)\\s*(\\/)?>)', 'gi');
}

/**
 * Парсинг шаблона.
 * @param {string} content Тело шаблона
 * @function
 */
Parser.prototype.parse = function (content) {
	var xmlDeclaration, parseResult, attribute, text;
	var lastIndex = 0;

	if (typeof String(content) !== 'string') {
		throw 'Invalid content type';
	}

	/**
	 * Текущая глубина тегов.
	 * @type number
	 */
	this.depth = 0;

	xmlDeclaration = content.match(regExpXML);

	if (xmlDeclaration) {
		xmlDeclaration = xmlDeclaration[0];
		content = content.substring(xmlDeclaration.length);
	} else {
		xmlDeclaration = '';
	}

	/**
	 * Код XML-декларации шаблона.
	 * @type string
	 */
	this.xmlDeclaration = xmlDeclaration;

	/**
	 * Тело шаблона без XML-декларации.
	 * @type string
	 */
	this.content = content;

	/**
	 * Текущий объект тега.
	 * @type object
	 */
	this.current = {
		index: 0,
		source: ''
	};

	/**
	 * Объект корневого тега шаблона.
	 * @type object
	 */
	this.root = this.current;

	this.onStart();

	while (parseResult = this.regExp.exec(content)) {
		var result = parseResult[0];
		var entity = parseResult[1];
		var comment = parseResult[2];
		var closeNodeName = parseResult[3];
		var openNodeName = parseResult[4];
		var attributes = parseResult[5];
		var isEmpty = parseResult[6];
		var index = parseResult.index;

		text = content.substring(lastIndex, index);

		if (text) {
			this.onText(this._fixText(text), this.current);
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
				name: openNodeName,
				isEmpty: isEmpty,
				parent: this.current,
				attributes: {}
			};

			while (attribute = regExpAttr.exec(attributes)) {
				newNode.attributes[attribute[1]] = (attribute[2] || attribute[3])
					.replace(/&amp;/g, '&')
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&quot;/g, '"')
					.replace(/&apos;/g, '\'');
			}

			delete this.addedText;
			this.onOpen(newNode);

			if (!isEmpty) {
				this.depth++;
				this.current = newNode;
			}
		} else if (closeNodeName) {
			var parent = this.current.parent;

			closeNodeName = closeNodeName.toLowerCase();

			if (this.current.name === closeNodeName) {
				delete this.addedText;

				this.onClose({
					index: index,
					source: result,
					name: closeNodeName,
					parent: parent
				});

				this.depth--;
				this.current = parent;
			} else if (parent && closeNodeName === parent.name) {
				delete this.addedText;
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
				this.onText(this._fixText(result), this.current);
			}
		} else { // CDATA
			this.onText(this._fixText(result), this.current);
		}

		lastIndex = index + result.length;
	}

	text = content.substring(lastIndex);

	if (text) {
		this.onText(this._fixText(text), this.current);
	}

	if (this.depth) {
		do {
			if (this.current !== this.root) {
				this._error('Tag is not closed.', this.current);
			}
		} while (this.current = this.current.parent);
	}

	return this;
};

/**
 * Исправление текстовых данных перед добавлением в код шаблона.
 * @param {string} text Текстовые данные.
 * @return {string} Исправленные текстовые данные.
 * @private
 */
Parser.prototype._fixText = function (text) {
	var tabSize, spaceSize;

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

/**
 * Создание ошибки парсинга тега.
 * @param {string} message Сообщение ошибки.
 * @param {object} node Объект тега, для которого генерируется ошибка.
 * @private
 */
Parser.prototype._error = function (message, node) {
	var error = new Error(message);
	var content = (this.xmlDeclaration + this.content).substr(0, node.index + this.xmlDeclaration.length) + node.source;

	error.nodeName = node.name;
	error.line = content.split(/(?:\r\n)|\r|\n/).length;
	error.char = content.substring(Math.max(content.lastIndexOf('\n'), content.lastIndexOf('\r'))).lastIndexOf(node.source.replace(/^\s+/, ''));

	this.onError(error);
};

module.exports = Parser;