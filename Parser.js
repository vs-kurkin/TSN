/**
 * @fileOverview Парсер TSN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */
var regExpAttr = /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:(?:\\)?"([^"]*?)(?:\\)?")|(?:(?:\\)?'([^']*?)(?:\\)?')))?/gi;
var regExpXML = /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*(<!DOCTYPE\s+[a-z\-_]+(?::[a-z\-_]+)?(?:\s+PUBLIC\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:\[[\s\S]*?\])?)?\s*>)?/i;

/**
 * Парсер TSN-шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} config Объект конфигурации шаблона.
 * @constructor
 */
function Parser (source, config) {
	var space = '(?:(?:(?:\\r\\n)|\\r|\\n)[^\\S\\r\\n]*)?';
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

	var regExp = new RegExp('(?:' + space + '&' + config.namespace + '.([a-z0-9\\-_\\.]+)?;)|(' + space + '<!--(?!\\[if [^\\]]+?\\]>)[\\s\\S]*?(?!<!\\[endif\\])-->)' + cdata + '|(?:' + space + '<\\/\\s*' + config.namespace + ':([a-z\\-_]+)\\s*>)|(?:' + space + '<\\s*' + config.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:(?:\\\\)?"[^"]*(?:\\\\)?")|(?:(?:\\\\)?\'[^\']*(?:\\\\)?\')))*)\\s*(\\/)?>)', 'gi');

	var xmlDeclaration, parseResult, attribute, text;
	var lastIndex = 0;

	if (typeof String(source) !== 'string') {
		throw 'Invalid content type';
	}

	/**
	 * Текущая глубина тегов.
	 * @type number
	 */
	this.depth = 0;

	xmlDeclaration = source.match(regExpXML);

	if (xmlDeclaration) {
		xmlDeclaration = xmlDeclaration[0];
		source = source.substring(xmlDeclaration.length);
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
	this.content = source;

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

	while (parseResult = regExp.exec(source)) {
		var result = parseResult[0];
		var entity = parseResult[1];
		var comment = parseResult[2];
		var closeNodeName = parseResult[3];
		var openNodeName = parseResult[4];
		var attributes = parseResult[5];
		var isEmpty = parseResult[6];
		var index = parseResult.index;

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
				name: openNodeName,
				isEmpty: isEmpty,
				parent: this.current,
				attributes: {}
			};

			while (attribute = regExpAttr.exec(attributes)) {
				newNode.attributes[attribute[1]] = (attribute[2] || attribute[3]).replace(/&amp;/g, '&')
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
		} else { // CDATA
			this.onText(result, this.current);
		}

		lastIndex = index + result.length;
	}

	text = source.substring(lastIndex);

	if (text) {
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

	return this;
}

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
	error.char = content
		.substring(Math.max(content.lastIndexOf('\n'), content.lastIndexOf('\r')))
		.lastIndexOf(node.source.replace(/^\s+/, ''));

	this.onError(error);
};

module.exports = Parser;