var events = require('events');

var regExpAttr = /\s*([a-z\-_]+(?::[a-z\-_]+)?)\s*(?:=\s*(?:(?:(?:\\)?"([^"]*?)(?:\\)?")|(?:(?:\\)?'([^']*?)(?:\\)?')))?/gi;
var regExpXML = /^\s*<\?xml(?:\s+[a-z\-_]+(?::[a-z\-_]+)?\s*=\s*"[^"]*")*\s*\?>\s*(<!DOCTYPE\s+[a-z\-_]+(?::[a-z\-_]+)?(?:\s+PUBLIC\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:(?:"[^"]*")|(?:'[^']*'))?\s*(?:\[[\s\S]*?\])?)?\s*>)?/i;

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

	this.config = config;
	this.regExpNode = new RegExp('(?:' + space + entity + space + ')|(' + space + '<!--(?!\\[if [^\\]]+?\\]>)[\\s\\S]*?(?!<!\\[endif\\])-->' + space + ')' + cdata + '|(?:' + space + '<\\/\\s*' + config.namespace + ':([a-z\\-_]+)\\s*>)|(?:' + space + '<\\s*' + config.namespace + ':([a-z\\-_]+)((?:\\s+[a-z\\-_]+(?::[a-z\\-_]+)?\\s*=\\s*(?:(?:(?:\\\\)?"[^"]*(?:\\\\)?")|(?:(?:\\\\)?\'[^\']*(?:\\\\)?\')))*)\\s*(\\/)?>)', 'gi');
}

Parser.prototype = new events.EventEmitter();

Parser.prototype.parse = function (data) {
	var xmlDeclaration, parseResult, attribute, text;
	var lastIndex = 0;

	if (typeof String(data) !== 'string') {
		throw 'Invalid data type';
	}

	this.depth = 0;

	xmlDeclaration = data.match(regExpXML);

	if (xmlDeclaration) {
		this.xmlDeclaration = xmlDeclaration[0];
		data = data.substring(this.xmlDeclaration.length);
	} else {
		this.xmlDeclaration = '';
	}

	this.data = data;
	this.root = this.current = {
		index: 0,
		source: ''
	};

	this.emit('start');

	while (parseResult = this.regExpNode.exec(data)) {
		var result = parseResult[0];
		var entity = parseResult[1];
		var comment = parseResult[2];
		var closeNodeName = parseResult[3];
		var openNodeName = parseResult[4];
		var attributes = parseResult[5];
		var isEmpty = parseResult[6];
		var index = parseResult.index;

		text = data.substring(lastIndex, index);

		if (text) {
			this.emit('text', this.current, this._fixText(text));
		}

		if (entity) {
			this.emit('entity', {
				index: index,
				source: result,
				parent: this.current,
				data: entity
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

	text = data.substring(lastIndex);

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

Parser.prototype._error = function (message, node) {
	var error = new Error(message);
	var data = (this.xmlDeclaration + this.data).substr(0, node.index + this.xmlDeclaration.length) + node.source;

	error.nodeName = node.name;
	error.line = data.split(/(?:\r\n)|\r|\n/).length;
	error.char = data.substring(Math.max(data.lastIndexOf('\n'), data.lastIndexOf('\r'))).lastIndexOf(node.source.replace(/^\s+/, ''));

	this.emit('error', error);

	return this;
};

module.exports = Parser;