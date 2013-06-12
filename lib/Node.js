var
	CONST = require('./const.js'),
	nodeDefinition = require('./tags.js');

function Node(parser, elem, attrs, prefix, eventHandler) {
	var
		attrNode,
		attrName,
		attrValue,
		index = 0,
		length = attrs.length,
		uri,
		definition,
		currentNode = eventHandler.current;

	this.name = elem.toLowerCase();
	this.prefix = prefix ? String(prefix).toLowerCase() : '';
	//this.type = CONST.TYPE_ELEMENT_NODE;
	this.attributes = {};
	this.children = [];
	this.parent = currentNode;
	this.index = currentNode.children.length;
	this.namespaces = Object.create(currentNode.namespaces);
	//this.code = '';
	this.line = parser.getLineNumber();
	this.column = parser.getColumnNumber();
	this.namespace = this.namespaces[''];
	//this.state = CONST.STATE_TEXT;
	//this.firstState = undefined;
	//this.value = '';

	definition = nodeDefinition[this.name];

	if (definition) {
		this.parse = definition.parse;
		this.template = definition.template;
		this.print = definition.print;
		this.mayBeError = definition.mayBeError;
		this.templateError = definition.templateError;
		this.templateType = definition.templateType;
	}

	while (index < length) {
		attrNode = attrs[index++];
		attrName = attrNode[0];
		attrValue = attrNode[1];

		if (attrName.slice(0, 5) === 'xmlns') {
			this.namespaces[attrName.slice(6)] = attrValue;

			if (attrValue !== CONST.NS) {
				this.attributes[attrName] = attrValue;
			}
		} else {
			this.attributes[attrName] = attrValue;
		}
	}

	if (this.prefix !== '') {
		uri = this.namespaces[this.prefix];

		if (typeof uri === 'string' && uri !== '') {
			this.namespace = uri;
		} else {
			eventHandler.onError('Tag prefix is not defined.');
		}
	}

	/*if (this.namespace === CONST.NS && nodeDefinition.hasOwnProperty(this.name)) {
		switch (this.templateType) {
			case CONST.TEMPLATE_TYPE_TEXT:
				this.state = CONST.STATE_TEXT;
				break;

			case CONST.TEMPLATE_TYPE_CODE:
				this.state = CONST.STATE_CODE;
				break;

			case CONST.TEMPLATE_TYPE_INHERIT:
				this.state = this.parent.state;
				break;
		}
	}*/
}

Node.prototype.toString = function () {
	var
		fullName = this.prefix ? this.prefix + ':' + this.name : this.name,
		result = '<' + fullName,
		name,
		value,
		attributes = this.attributes;

	for (name in attributes) {
		if (attributes.hasOwnProperty(name)) {
			value = attributes[name];

			switch (typeof value) {
				case 'string':
					result += ' ' + name + '=\\"' + value + '\\"';
					break;

				case 'object':
					break;
			}
		}
	}

	this.code += '__attrIndex = __buffer.length;';

	if (this.children.length) {
		/*switch (this.state) {
			case CONST.STATE_CODE:
				this.code += '__buffer.push("';
				break;
		}*/

		result += '>' + this.code + '</' + fullName + '>';
	} else {
		result += '/>';
	}

	//this.state = CONST.STATE_TEXT;

	return result;
};

Node.prototype.fixAttributes = function  () {
	var
		definition = nodeDefinition[this.name],
		attrDefinition,
		attrValue,
		attributes = this.attributes,
		name;

	for (name in definition.attributes) {
		if (definition.attributes.hasOwnProperty(name)) {
			attrDefinition = definition.attributes[name];

			if (attributes && attributes.hasOwnProperty(name)) {
				attrValue = attributes[name];

				switch (attrDefinition.type) {
					case 'string':
						attributes[name] = '"' + attrValue.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1") + '"';
						break;
					case 'number':
						if (isNaN(attrValue)) {
							return new Error('The value of the attribute "' + name + '" must be a number', this);
						}
						break;
				}
			} else if (attrDefinition.required === true) {
				return new Error('Attribute "' + name + '" is not defined.');
			} else if (attrDefinition.hasOwnProperty('defaultValue')) {
				attributes[name] = attrDefinition.defaultValue;
			}
		}
	}

	return true;
};

Node.prototype.compile = (function () {
	var node;

	function replace (result, type, name) {
		switch (type) {
			case '!':
				switch (name) {
					case 'code':
						if (node.state === CONST.STATE_TEXT && node.templateType === CONST.TEMPLATE_TYPE_CODE) {
							node.code += '");';
							node.state = CONST.STATE_CODE;
						}

						return node.code;
					case 'context':
						return node.attributes.hasOwnProperty('context') ? node.attributes.context : 'this';
				}
				break;
			case '@':
				return node.attributes[name] || '';
		}

		return result;
	}

	return function (config) {
		node = this;

		var code = this.template.replace(/\/\*(?:(!|@)([a-z\-_]+)?)\*\//gi, replace);

		if (this.print === true) {
			code = '__buffer.push(' + code + ');';
		}

		if (this.mayBeError === true) {
			code =
				'try {' + code + '} catch (error) {' +
					this.templateError +
					'__error(error, __template, ' + (config.debug === true ? '__buffer' : 'null') + ', "' + this.name + '", ' + this.line + ', ' + this.column + ');' +
				'}';

			this.templateType = CONST.TEMPLATE_TYPE_CODE;
		}

		return code;
	};
}());

module.exports = Node;
