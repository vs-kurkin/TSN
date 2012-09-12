var NS = 'TEN';

var TEMPLATE_TYPE_TEXT = 1;
var TEMPLATE_TYPE_CODE = 2;
var TEMPLATE_TYPE_INHERIT = 3;

this.root = {
	attributes: {
		context: {}
	},
	parse: function () {
		if (this.attributes.hasOwnProperty('context')) {
			this.template =
				'(function () {' +
					'/*!code*/' +
				'}).call(/*!context*/);';

			this.templateType = TEMPLATE_TYPE_CODE;
			this.mayBeError = this.attributes.context !== 'this';
		}
	},
	template: '/*!code*/',
	mayBeError: false,
	templateType: TEMPLATE_TYPE_INHERIT,
	print: false
};

this['comment'] = {
	template: '',
	templateType: TEMPLATE_TYPE_INHERIT,
	print: false,
	mayBeError: false
};

this.context = {
	attributes: {
		object: {}
	},
	parse: function () {
		if (!this.attributes.hasOwnProperty('object')) {
			this.template = '/*!code*/';
			this.mayBeError = false;
			this.templateType = TEMPLATE_TYPE_INHERIT;
		} else if (this.attributes.object === 'this') {
			this.mayBeError = false;
		}
	},
	template:
		'(function () {' +
			'/*!code*/' +
		'}).call(/*@object*/);',
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: true,
	print: false
};

this.echo = (function () {
	var escape = {
		js: '.replace(/(\'|"|(?:\\r\\n)|\\r|\\n|\\\\)/g, "\\\\$1")',

		url: 'encodeURI(/*text*/)',

		html:
			'.replace(/&/g, "&amp;")' +
			'.replace(/</g, "&lt;")' +
			'.replace(/>/g, "&gt;")' +
			'.replace(/\"/g, "&quot;")',

		htmlDec:
			'.replace(/&/g, "&#38;")' +
			'.replace(/</g, "&#60;")' +
			'.replace(/>/g, "&#62;")' +
			'.replace(/\"/g, "&#34;")',

		htmlHex:
			'.replace(/&/g, "&#x26;")' +
			'.replace(/</g, "&#x3c;")' +
			'.replace(/>/g, "&#x3e;")' +
			'.replace(/\"/g, "&#x22;")'
	};

	return {
		attributes: {
			data: {
				defaultValue: 'this'
			},
			escape: {}
		},
		parse: function () {
			var attributes = this.attributes;
			var template = 'String(' + attributes.data + ')';

			if (attributes.hasOwnProperty('escape')) {
				if (escape.hasOwnProperty(attributes.escape)) {
					template += escape[attributes.escape];
				} else {
					return Error('Invalid value of attribute "escape"');
				}
			}

			this.template = template;
		},
		templateType: TEMPLATE_TYPE_TEXT,
		mayBeError: false,
		print: true
	};
}());

this['data'] = {
	attributes: {
		key: {
			type: 'string',
			required: true
		},
		action: {
			defaultValue: 'replace'
		},
		value: {}
	},
	start: function () {
		// Move in implementation of the tag "render".
		return '';
	},
	parse: function () {
		var attributes = this.attributes;

		this.template = attributes.hasOwnProperty('value') ? 'String(/*@value*/)' : 'result';

		switch (attributes.action) {
			case 'append':
				this.template = '(_data[/*@key*/] || "") + ' + this.template + ';';
				break;
			case 'prepend':
				this.template = this.template + ' + (_data[/*@key*/] || "");';
				break;
			case 'replace':
				this.template = this.template + ';';
				break;
			default:
				return new Error('Invalid value of attribute "action"');
		}

		if (attributes.hasOwnProperty('value')) {
			this.template = '_data[/*@key*/] = ' + this.template;
		} else {
			this.template =
				'(function (__stack) {' +
					'/*!code*/' +
					'__stack.end(function (result) {' +
						'_data[/*@key*/] = ' + this.template +
					'});' +
				'}).call(/*!context*/, new __Stack());';
		}
	},
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: true,
	print: false
};

this['if'] = {
	attributes: {
		expr: {
			defaultValue: 'this'
		}
	},
	parse: function () {
		if (this.lines) {
			this.lines.unshift(this.line);
			this.line = '"' + this.lines.join(', ') + '"';
		}
	},
	template:
		'if (/*@expr*/) {' +
			'/*!code*/' +
		'}',
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: true,
	print: false
};

this['else'] = {
	attributes: {
		'if': {}
	},
	parse: function () {
		var parent = this.parent;
		var attributes = this.attributes;

		if (parent.name !== 'if') {
			return new Error('Tag "else" must have a parent "if".');
		} else if (parent.hasElse) {
			return new Error('Tag "if" should have one child "else".');
		} else if (this.isEmpty) {
			parent.template = parent.template.replace('/*!code*/', parent.code).slice(0, -1) + '/*!code*/}';
			parent.code = '';

			if (attributes.hasOwnProperty('if')) {
				if (!parent.lines) {
					parent.lines = [];
				}

				parent.lines.push(this.line);
				this.template = '} else if (/*@if*/) {/*!code*/';
			} else {
				parent.hasElse = true;
			}
		} else {
			return new Error('Tag else should be a single');
		}
	},
	template: '} else {/*!code*/',
	templateType: TEMPLATE_TYPE_CODE,
	print: false,
	mayBeError: false
};

this['each'] = {
	attributes: {
		array: {},
		object: {},
		item: {}
	},
	parse: function () {
		var attributes = this.attributes;
		var hasItem = attributes.hasOwnProperty('item');

		if (attributes.hasOwnProperty('array')) {
			this.template =
				'var ' +
					'_array = /*@array*/,' +
					'_length = _array.length,' +
					'_index = 0;' +

				'while (_index < _length) {' +
					(hasItem ? 'var /*@item*/ = _array[_index];' : '') +
					'/*!code*/' +
					'_index++;' +
				'}' +

				'_array = _length = _index = ' + (hasItem ? '/*@item*/ = ' : '') + 'void 0;';
		} else if (attributes.hasOwnProperty('object')) {
			this.template =
				'var ' +
					'_property,' +
					'_object = /*@object*/,' +

				'for (_property in _object) {' +
					'if (_object.hasOwnProperty(_property)) {' +
						(hasItem ? 'var /*@item*/ = _object[_property];' : '') +
						'/*!code*/' +
					'}' +
				'}' +

				'_property = _object = ' + (hasItem ? '/*@item*/ = ' : '') + 'void 0;';
		} else {
			return new Error('Attribute "array" or "object" is not defined.');
		}
	},
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: true,
	print: false
};

(function (API) {
	var globalBlocks = {};

	var LIB = {
		path: require('path')
	};

	API.block = {
		attributes: {
			name: {
				type: 'string'
			},
			type: {
				defaultValue: 'global'
			}
		},
		start: function (document, API, TEN) {
			document.initCode += 'var __block = {};';
			API.__globalBlock = globalBlocks;
		},
		parse: function (document, API, TEN) {
			var attributes = this.attributes;
			var name = attributes.name;

			if (name === '') {
				return new Error('Attribute "name" is empty.');
			} else {
				switch (attributes.type) {
					case 'default':
						this.template =
							'if (!__block.hasOwnProperty(' + name + ')) {' +
								'__block[' + name + '] = ' + this.template +
							'}';
						break;
					case 'local':
						this.template = '__block[' + name + '] = ' + this.template;
						break;
					case 'global':
						this.template = '__globalBlock[' + name + '] = ' + this.template;
						break;
					default:
						return new Error('Invalid value of attribute "type"');
				}
			}
		},
		template:
			'function (__stack, __localBlock) {' +
				'var _context = this;' +
				'/*!code*/' +
			'};',
		templateType: TEMPLATE_TYPE_CODE,
		print: false,
		initCode: true,
		mayBeError: false
	};

	API.render = {
		attributes: {
			file: {
				type: 'string'
			},
			block: {
				type: 'string'
			},
			config: {}
		},
		parse: function (parser) {
			var attributes = this.attributes;
			var config = parser.config;

			if (attributes.hasOwnProperty('file')) {
				if (attributes.file.charAt(0) !== '/') {
					if (!config.hasOwnProperty('dir')) {
						config.dir = config.templateRoot;
					}

					attributes.file = LIB.path
						.relative(config.templateRoot, LIB.path.resolve(config.dir, attributes.file))
						.replace(/\\/g, '\\\\');
				}

				if (!attributes.hasOwnProperty('config')) {
					var path = config.path;
					delete config.path;
					attributes.config = config.inheritConfig === true ? JSON.stringify(config) : 'null';
					config.path = path;
				}

				this.template =
					'__TEN.parent = {' +
						'__stack: __stack,' +
					'};' +

					'__TEN' +
						'.compileFile(/*@file*/, /*@config*/)' +
						'.render(/*!context*/, __stream, __stack);' +

					'delete __TEN.parent;';
			} else if (attributes.hasOwnProperty('block')) {
				var blockName = attributes.block;

				this.template = '(' +
					'__localBlock[' + blockName + '] || ' +
					'__block[' + blockName + '] || ' +
					'__globalBlock[' + blockName + '] || ' +
					'Object)' +
						'.call(/*!context*/, __stack, __block);';
			} else {
				return new Error('Attribute "block" or "file" is not defined.');
			}
		},
		templateType: TEMPLATE_TYPE_CODE,
		mayBeError: false,
		print: false
	};
}(this));

this.script = {
	attributes: {
		type: {
			defaultValue: 'global'
		}
	},
	parse: function (parser) {
		var attributes = this.attributes;
		var text = this.text.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1');

		switch (attributes.type) {
			case 'global':
				this.template = text;
				break;
			case 'local':
				parser.print = false;

				this.print = true;
				this.template =
					'((function () {' +
						text +
					'}).call(/*!context*/) || "")';
				break;
			default:
				return new Error('Invalid value of attribute "type"');
		}
	},
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: true,
	print: false
};

this.header = {
	attributes: {
		name: {
			type: 'string',
			required: true
		},
		value: {
			type: 'string'
		}
	},
	parse: function () {
		if (!this.attributes.hasOwnProperty('value')) {
			this.template =
				'(function (__stack) {' +
					'/*!code*/' +
					'__stack.end(function (result) {' +
						'__stream.setHeader(/*@name*/, result);' +
					'});' +
				'}).call(/*!context*/, new __Stack())';
		}
	},
	template: '__stream.setHeader(/*@name*/, /*@value*/);',
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: true,
	print: false
};

this.status = {
	attributes: {
		code: {
			type: 'number',
			required: true
		}
	},
	template: '__stream.statusCode = /*@code*/;',
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: false,
	print: false
};

this.async = {
	attributes: {
		method: {
			required: true
		},
		arguments: {
			defaultValue: ''
		},
		params: {
			defaultValue: ''
		}
	},
	parse: function () {
		var attributes = this.attributes;

		if (attributes.hasOwnProperty('arguments') && attributes.arguments !== '') {
			attributes.arguments += ',';
		}

		this.template =
			'(function (__stack) {' +
				attributes.method + '(' + attributes.arguments + 'function (' + attributes.params + ') {' +
					'/*!code*/' +
					'__stack.end();' +
				'});' +
			'})(new __Stack(__stack));';
	},
	templateError: '__stack.wait--;',
	templateType: TEMPLATE_TYPE_CODE,
	mayBeError: true,
	print: false
};

this.attribute = (function () {
	function getNode (node) {
		var parent;

		while (parent = node.parent) {
			if (parent.namespace !== NS) {
				return parent;
			}
		}

		return new Erorr('');
	}

	return {
		attributes: {
			name: {
				type: 'string',
				required: true
			},
			value: {
				type: 'string',
				required: false
			}
		},

		parse: function () {
			var
				attributes = this.attributes,
				node = getNode(this);

			if (attributes.hasOwnProperty(value)) {
				this.template = '';
				node.mayBeError = true;
				node.attributes[attributes.name] = this;
			} else {

			}

		},

		template: '/*!code*/',
			templateType: TEMPLATE_TYPE_INHERIT,
			mayBeError: false,
			print: false
	};
}());