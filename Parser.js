/**
 * @fileOverview Парсер TSN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.2.0 beta
 */

var events = require('events');

var regExpAttr = /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:(?:\\)?"([^"]*?)(?:\\)?")|(?:(?:\\)?'([^']*?)(?:\\)?')))?/gi;
var regExpXML = /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*(<!DOCTYPE\s+[a-z\-_]+(?::[a-z\-_]+)?(?:\s+PUBLIC\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:\[[\s\S]*?\])?)?\s*>)?/i;

/**
 * Парсер TSN-шаблона. Экземпляры наследуют от <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.
 * @param {object} config Объект конфигурации шаблона.
 * @constructor
 */
function Parser (config) {
	var space = '(?:(?:(?:\\r\\n)|\\r|\\n)[^\\S\\r\\n]*)?';
	var entity = '&' + config.namespace + '.([a-z\\-_]+)?;';
	var cdata = config.parseCDATA === true ? '' : '|(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)';

	if (!(config.hasOwnProperty('namespace') && (/[a-z\d\-_]+/i).test(config.namespace))) {
		this.emit('error', new Error('Invalid namespace.'));
		config.namespace = 'tsn';
	}

	if (typeof config.tabSize !== 'number' || config.tabSize < 1) {
		this.emit('error', new Error('Invalid tab size.'));
		config.tabSize = 2;
	} else {
		config.tabSize = Number(config.tabSize.toFixed(0));
	}

	if (typeof config.indent !== 'number' || config.indent < 1) {
		this.emit('error', new Error('Invalid indent.'));
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
	this.regExp = new RegExp('(?:' + space + entity + space + ')|(' + space + '<!--(?!\\[if [^\\]]+?\\]>)[\\s\\S]*?(?!<!\\[endif\\])-->' + space + ')' + cdata + '|(?:' + space + '<\\/\\s*' + config.namespace + ':([a-z\\-_]+)\\s*>)|(?:' + space + '<\\s*' + config.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:(?:\\\\)?"[^"]*(?:\\\\)?")|(?:(?:\\\\)?\'[^\']*(?:\\\\)?\')))*)\\s*(\\/)?>)', 'gi');
}

Parser.prototype = new events.EventEmitter();

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
		content = content.substring(this.xmlDeclaration.length);
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

	this.emit('start');

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
			this.emit('text', this.current, this._fixText(text));
		}

		if (entity) {
			this.emit('entity', {
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
				newNode.attributes[attribute[1]] = attribute[2] || attribute[3];
			}

			this.emit('open', newNode);

			if (!isEmpty) {
				this.depth++;
				this.current = newNode;
			}
		} else if (closeNodeName) {
			var parent = this.current.parent;

			closeNodeName = closeNodeName.toLowerCase();

			if (this.current.name === closeNodeName) {
				this.emit('close', this.current);
				this.depth--;
				this.current = parent;
			} else if (parent && closeNodeName === parent.name) {
				this._error('Tag is not closed.', parent);
				this.depth--;
				this.current = parent;
			} else {
				this._error('Closing tag matches nothing.', {
					index: index,
					source: result,
					name: closeNodeName
				});
			}
		} else if (comment) {
			if (this.config.saveComments === true) {
				this.emit('text', this.current, this._fixText(result));
			}
		} else { // CDATA
			this.emit('text', this.current, this._fixText(result));
		}

		lastIndex = index + result.length;
	}

	text = content.substring(lastIndex);

	if (text) {
		this.emit('text', this.current, this._fixText(text));
	}

	if (this.depth) {
		do {
			if (this.current !== this.root) {
				this._error('Tag is not closed.', this.current);
			}
		} while (this.current = this.current.parent);
	}

	this.emit('end');
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

		text = text.replace(new RegExp('((?:\\r\\n)|\\r|\\n)[\\t]{' + tabSize + '}|[ ]{' + spaceSize + '}', 'g'), '$1');
	}

	return text
		.replace(/\\/g, '\\\\')
		.replace(/(["'\t])/g, '\\$1')
		.replace(/\r/g, '\\r')
		.replace(/\n/g, '\\n')
		.replace(/\f/g, '\\f')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
};

/**
 * Создание ошибки парсинга тега.
 * @param {string} message Сообщение ошибки.
 * @param {object} node Объект тега, для коготоро генерируется ошибка.
 * @private
 */
Parser.prototype._error = function (message, node) {
	var error = new Error(message);
	var content = (this.xmlDeclaration + this.content).substr(0, node.index + this.xmlDeclaration.length) + node.source;

	error.nodeName = node.name;
	error.line = content.split(/(?:\r\n)|\r|\n/).length;
	error.char = content.substring(Math.max(content.lastIndexOf('\n'), content.lastIndexOf('\r'))).lastIndexOf(node.source.replace(/^\s+/, ''));

	this.emit('error', error);
};

module.exports = Parser;

/**
 * @event
 * @name Parser#start
 * @description Начало парсинга шаблона.
 */

/**
 * @event
 * @name Parser#end
 * @description Завершение парсинга шаблона.
 */

/**
 * @event
 * @name Parser#open
 * @param {object} node Объект найденного тега.
 * @param {number} node.index Номер символа, с которого был найден тег.
 * @param {string} node.source Исходный код тега.
 * @param {string} node.name Имя тега.
 * @param {boolean} node.isEmpty Флаг, указывающий на то, что тег одиночный.
 * @param {object} node.parent Ссылка на объект родительского тега.
 * @param {object} node.attributes Объект атрибутов тега.
 * @description Найден открывающийся тег.
 */

/**
 * @event
 * @name Parser#close
 * @param {object} node Объект тега, который был закрыт.
 * @param {number} node.index Номер символа, с которого был найден тег.
 * @param {string} node.source Исходный код тега.
 * @param {string} node.name Имя тега.
 * @param {boolean} node.isEmpty Флаг, указывающий на то, что тег одиночный.
 * @param {object} node.parent Ссылка на объект родительского тега.
 * @param {object} node.attributes Объект атрибутов тега.
 * @description Найден закрывающийся тег.
 */

/**
 * @event
 * @name Parser#text
 * @param {string} text Тектовые данные.
 * @description Найдены текстовые данные (текст, CDATA, комментарий).
 */

/**
 * @event
 * @name Parser#entity
 * @param {object} node Объект сущности.
 * @param {number} node.index Номер символа, с которого был найден тег.
 * @param {string} node.source Исходный код тега.
 * @param {object} node.parent Ссылка на объект родительского тега.
 * @param {string} node.name Имя TSN-сущности.
 * @description Найдена TSN-сущность.
 */

/**
 * @event
 * @name Parser#error
 * @param {error} error Объект ошибки.
 * @param {string} error.message Текстовое сообщение ошибки.
 * @param {number} error.nodeName Имя тега, сгенерировавшего ошибку.
 * @param {number} error.line Номер строки, на которой находится тег, сгенерировавший ошибку.
 * @param {number} error.char Символ, с которого начинается тег, сгенерировавший ошибку.
 * @description Ошибка парсинга шаблона.
 */