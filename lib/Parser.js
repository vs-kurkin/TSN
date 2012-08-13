var entityRegExp = /&([a-z0-9\-_\.]+);/gi;
var regExpSpace = '(?:(?:(?:\\r\\n)|\\r|\\n)[^\\S\\r\\n]*)*',
	regExpAttr = /\s*(([a-z\-_]+)(?::([a-z\-_]+))?)\s*(?:=\s*(?:(?:(?:\\)?"([^"]*?)(?:\\)?")|(?:(?:\\)?'([^']*?)(?:\\)?')))?/gi,
	regExpDTD = '\x3c!DOCTYPE\\s+[a-z\\-_0-9]+(?::[a-z\\-_0-9]+)?(?:(?:\\s+PUBLIC\\s*(?:(?:"[^"]*")|(?:\'[^\']*\'))?\\s*(?:(?:"[^"]*")|(?:\'[^\']*\'))?(?:\\s*\\[[\\s\\S]*?\\])?)|(?:\\s+SYSTEM\\s*(?:(?:"[^"]*")|(?:\'[^\']*\'))?(?:\\[[\\s\\S]*?\\])?)|(?:\\s*\\[[\\s\\S]*?\\]))?\\s*>',
	regExpXML = new RegExp(regExpSpace + '^\\s*<\\?xml(?:\\s+[a-z\\-_0-9]+(?::[a-z\\-_0-9]+)?\\s*=\\s*"[^"]*")*\\s*\\?>\\s*(' + regExpSpace + regExpDTD + ')?');

var regExp = new RegExp('(<!--(?!\\[if [^\\]]+?\\]>)[\\s\\S]*?(?!<!\\[endif\\])-->)|(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>)|(' + regExpDTD + ')|(?:<\\/\\s*([a-z\\-_0-9]+)(?::([a-z\\-_0-9]+))?\\s*>)|(?:<\\s*([a-z\\-_0-9]+)(?::([a-z\\-_0-9]+))?((?:\\s+[a-z\\-_0-9]+(?::[a-z\\-_0-9]+)?\\s*=\\s*(?:(?:(?:\\\\)?"[^"]*(?:\\\\)?")|(?:(?:\\\\)?\'[^\']*(?:\\\\)?\')))*)\\s*(\\/)?>)', 'gi');

var createNS = (function () {
	function F() {
	}

	return function (NS) {
		F.prototype = NS || Object.prototype;
		return new F();
	};
})();

function toString(isClose) {
	var
		result,
		name;

	if (isClose !== true) {
		result = '<' + this.fullName;

		for (name in this.attributes) {
			if (this.attributes.hasOwnProperty(name)) {
				result += ' ' + name + '="' + this.attributes[name] + '"';
			}
		}

		if (this.isEmpty === true) {
			result += '/';
		}
	} else {
		result = '</' + this.fullName;
	}

	return result + '>';
}

function Parser(source, config) {
	var xmlDeclaration,
		lastIndex = 0,
		parseResult,
		attribute,
		text;

	this.namespaces = {};

	/**
	 * Объект конфигурации шаблона: {@link TEN.config}.
	 * @type object
	 */
	this.config = config;

	if (xmlDeclaration = source.match(regExpXML)) {
		xmlDeclaration = xmlDeclaration[0];
		source = source.substring(xmlDeclaration.length);
	} else {
		xmlDeclaration = '';
	}

	this.depth = 0;

	this.source = source;

	var result = {
		type: Parser.TYPE_DOCUMENT_NODE,
		children: [],
		namespaces: createNS()
	};

	this.current = result;

	while (parseResult = regExp.exec(source)) {
		var
			index = parseResult.index,
			resultParse = parseResult[0],
			comment = parseResult[1],
			cdata = parseResult[2],
			dtd = parseResult[3],
			closeNodePrefix = parseResult[4],
			closeNodeName = parseResult[5],
			openNodePrefix = parseResult[6],
			openNodeName = parseResult[7],
			attributes = parseResult[8],
			isEmpty = parseResult[9] === '/';

		var node;

		text = source.substring(lastIndex, index);

		if (text) {
			this.current.children.push({
				type: Parser.TYPE_TEXT_NODE,
				parent: this.current,
				value: this._fixText(text),
				index: this.current.children.length
			});
		}

		if (openNodePrefix || openNodeName) {
			node = {
				name: (openNodeName || openNodePrefix).toLowerCase(),
				prefix: (openNodeName ? openNodePrefix : '').toLowerCase(),
				type: Parser.TYPE_ELEMENT_NODE,
				attributes: {},
				children: [],
				parent: this.current,
				isEmpty: isEmpty,
				index: this.current.children.length,
				namespaces: createNS(this.current.namespaces),
				toString: toString
			};

			node.fullName = node.prefix ? node.prefix + ':' + node.name : node.name;

			this._setNodePosition(node, xmlDeclaration, index, resultParse);

			while (attribute = regExpAttr.exec(attributes)) {
				var attrFullName = attribute[1];
				var attrName = (attribute[3] || attribute[2]).toLowerCase();
				var attrPrefix = (attribute[3] ? attribute[2] : '').toLowerCase();
				var attrValue = (attribute[4] || attribute[5])
					.replace(/&amp;/g, '&')
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&quot;/g, '"')
					.replace(/&apos;/g, '\'');

				if (attrFullName === 'xmlns') {
					node.namespaces[''] = attrValue;
				} else if (attrPrefix === 'xmlns') {
					node.namespaces[attrName] = attrValue;
				}

				node.attributes[attrFullName] = attrValue;
			}

			if (node.prefix) {
				if (node.prefix in node.namespaces) {
					node.namespace = node.namespaces[node.prefix];
				} else {
					//this.onError(Parser.ERR_UNDEF_PREFIX);
				}
			} else {
				node.namespace = node.namespaces[''];
			}

			this.current.children.push(node);

			if (!isEmpty) {
				this.depth++;
				this.current = node;
			}
		} else if (closeNodePrefix || closeNodeName) {
			var parent = this.current.parent;

			node = {
				name: (closeNodeName || closeNodePrefix).toLowerCase(),
				prefix: (closeNodeName ? closeNodePrefix : '').toLowerCase(),
				parent: parent
			};

			node.fullName = node.prefix ? node.prefix + ':' + node.name : node.name;

			this._setNodePosition(node, xmlDeclaration, index, resultParse);

			if (this.current.fullName === node.fullName) {
				delete this.current.namespaces;

				this.depth--;
				this.current = parent;
			} else if (parent && node.fullName === parent.fullName) {
				//this.onError(Parser.ERR_NOT_CLOSED, this.current);

				this.current = parent;
				this.depth--;

				//this.onError(node);
				this.current = parent.parent;
				this.depth--;
			} else {
				//this.onError(Parser.ERR_MATCHES_NOTHING, node);
			}

		} else if (comment) {
			this.current.children.push({
				type: Parser.TYPE_COMMENT_NODE,
				value: comment,
				index: this.current.children.length
			});
		} else if (dtd) {
			this.current.children.push({
				type: Parser.TYPE_DOCUMENT_TYPE_NODE,
				value: comment,
				index: this.current.children.length
			});
		} else if (cdata) {
			this.current.children.push({
				type: Parser.TYPE_CDATA_SECTION_NODE,
				value: comment,
				index: this.current.children.length
			});
		}

		lastIndex = index + resultParse.length;
	}

	if (text = source.substring(lastIndex)) {
		this.current.children.push({
			type: Parser.TYPE_TEXT_NODE,
			parent: this.current,
			value: this._fixText(text),
			index: this.current.children.length
		});
	}

	if (this.depth) {
		do {
			if (this.current !== result) {
				//this.onError(Parser.ERR_NOT_CLOSED, this.current);
			}
		} while (this.current = this.current.parent);
	}

	result.documentElement = result.children[0];
	result.documentElement.parent = result;
	delete result.namespaces;

	return result;
}

Parser.TYPE_ELEMENT_NODE = 1;
Parser.TYPE_TEXT_NODE = 3;
Parser.TYPE_CDATA_SECTION_NODE = 4;
Parser.TYPE_COMMENT_NODE = 8;
Parser.TYPE_DOCUMENT_NODE = 9;
Parser.TYPE_DOCUMENT_TYPE_NODE = 10;

Parser.ERR_NOT_CLOSED = 'Tag is not closed.';
Parser.ERR_MATCHES_NOTHING = 'Closing tag matches nothing.';
Parser.ERR_UNDEF_PREFIX = 'Tag prefix is not defined.';

Parser.prototype._fixText = function (text) {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, '\'');
};

Parser.prototype._setNodePosition = function (node, declaration, index, source) {
	var content = (declaration + this.source).substr(0, index + declaration.length) + source;

	node.line = content.split(/(?:\r\n)|\r|\n/).length;
	node.char = content
		.substring(Math.max(content.lastIndexOf('\n'), content.lastIndexOf('\r')))
		.lastIndexOf(source.replace(/^\s+/, ''));
};

module.exports = Parser;