/**
 * @fileOverview Описание тегов шаблонизатора TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */
this.root = {
	parse: function () {
		if (this.attributes.hasOwnProperty('context')) {
			this.template = '' +
				'(function () {' +
					'/*!code*/' +
				'}).call(/*!context*/);';
		}
	},
	template: '/*!code*/'
};

this['comment'] = {
	template: ''
};

this.context = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('object')) {
			this.template = '/*!code*/';
		}
	},
	template: '' +
		'(function () {' +
			'/*!code*/' +
		'}).call(/*@object*/);'
};

this.echo = (function () {
	var type = {
		json: 'JSON.stringify(/*text*/)'
	};

	var escape = {
		js: 'String(/*text*/)' +
			'.replace(/(\'|"|(?:\\r\\n)|\\r|\\n|\\\\)/g, "\\\\$1")',

		url: 'encodeURI(/*text*/)',

		html: 'String(/*text*/)' +
			'.replace(/&/g, "&amp;")' +
			'.replace(/</g, "&lt;")' +
			'.replace(/>/g, "&gt;")' +
			'.replace(/\"/g, "&quot;")',

		htmlDec: 'String(/*text*/)' +
			'.replace(/&/g, "&#38;")' +
			'.replace(/</g, "&#60;")' +
			'.replace(/>/g, "&#62;")' +
			'.replace(/\"/g, "&#34;")',

		htmlHex: '(/*text*/)' +
			'.replace(/&/g, "&#x26;")' +
			'.replace(/</g, "&#x3c;")' +
			'.replace(/>/g, "&#x3e;")' +
			'.replace(/\"/g, "&#x22;")'
	};

	return {
		parse: function (parser) {
			var attributes = this.attributes;
			var text = attributes.hasOwnProperty('text') ? attributes.text : 'this';

			if (attributes.hasOwnProperty('type') && type.hasOwnProperty(attributes.type)) {
				text = type[attributes.type].replace('/*text*/', text);
			}

			if (attributes.hasOwnProperty('escape') && escape.hasOwnProperty(attributes.escape)) {
				text = escape[attributes.escape].replace('/*text*/', text);
			}

			this.template = 'String(' + text + ')';
		},
		inline: true
	};
})();

this['data'] = {
	start: function () {
		return 'var _data = {};';
	},
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('name')) {
			return new Error('Attribute "name" is not defined.');
		}

		if (!attributes.hasOwnProperty('value')) {
			this.template = '' +
				'_data["/*@name*/"] = (function (__output, __text) {' +
					'var hasStream = false;' +
					'/*!code*/' +
					'return __output;' +
				'}).call(/*!context*/, "", "");';
		}
	},
	template: '_data["/*@name*/"] = (/*@value*/);'
};

this['if'] = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('test')) {
			this.attributes.test = 'this';
		}
	},
	template: '' +
		'if (/*@test*/) {' +
			'/*!code*/' +
		'}'
};

this.unless = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('test')) {
			this.attributes.test = 'this';
		}
	},
	template: '' +
		'if (!(/*@test*/)) {' +
			'/*!code*/' +
		'}'
};

this['else'] = {
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
				this.template = '} else if (' + attributes['if'] + ') {/*!code*/'
			} else {
				parent.hasElse = true;
			}
		} else {
			return new Error('Tag else should be a single');
		}
	},
	template: '} else {/*!code*/'
};

this['for'] = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('array')) {
			attributes.array = 'this';
		}

		this.template = '' +
			'(function (_array) {' +
				'var _length = _array.length;' +
				'var _index = 0;' +
				'while (_index < _length) {' +
					(attributes.hasOwnProperty('item') ? 'var /*@item*/ = _array[_index];' : '') +
					'/*!code*/' +
					'_index++;' +
				'}' +
			'}).call(/*!context*/, /*@array*/);'
	}
};

this['each'] = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('object')) {
			attributes.object = 'this';
		}

		this.template = '' +
			'(function (_object) {' +
				'for (var _property in _object) {' +
					'if (_object.hasOwnProperty(_property)) {' +
						(attributes.hasOwnProperty('item') ? 'var /*@item*/ = _object[_property];' : '') +
						'/*!code*/' +
					'}' +
				'}' +
			'}).call(/*!context*/, /*@object*/);'
	}
};

this.template = {
	start: function (parser) {
		if (!parser.parent) {
			return '' +
				'function Template () {' +
					'Template.prototype = this;' +
				'}';
		}
	},
	end: function (parser) {
		var code = '';

		if (parser.hasTemplates === true) {
			code = 'Template.prototype = Object.getPrototypeOf(Template.prototype);';
		}

		if (parser.parent) {
			code += ';' +
				'; __output += __text;' +
				'hasStream && __text !== "" && stream.write(__text, "' + parser.config.encoding + '");' +
				'hasStream = false;'
		}

		return code;
	},
	parse: function (parser) {
		var attributes = this.attributes;

		if (attributes.hasOwnProperty('name')) {
			if (attributes.name === '') {
				return new Error('Attribute "name" is empty.');
			} else {
				if (parser.hasTemplates !== true) {
					parser.root.code += ';var __template = new Template();';
					parser.hasTemplates = true;
				}
				this.template = '__template["' + attributes.name + '"] = function (__output, __text) {' +
						this.code +
						'; __output += __text;' +
						'hasStream && __text !== "" && stream.write(__text, "' + parser.config.encoding + '");' +
						'; return __output;' +
					'};';
			}
		} else {
			return new Error('Attribute "name" is not defined.');
		}
	},
	template: ''
};

this.include = (function () {
	var path = require('path');

	return {
		parse: function (parser, TSN) {
			var attributes = this.attributes;
			var prototype;
			var template;

			if (attributes.hasOwnProperty('src')) {
				prototype = parser.constructor.prototype;
				prototype.parent = parser;

				if (attributes.src.charAt(0) !== '/') {
					if (!parser.config.hasOwnProperty('path')) {
						parser.config.path = parser.config.templateRoot;
					}

					attributes.src = path.relative(parser.config.templateRoot, path.resolve(parser.config.path, attributes.src));
				}

				template = TSN.load(attributes.src, null, parser.config);

				delete prototype.parent;

				this.template = '' +
					';__output += (function () {' +
						template.source +
					'}).call(/*!context*/);';

			} else if (attributes.hasOwnProperty('name')) {
				this.template = ';__output += __template["' + attributes.name + '"].call(/*!context*/, "", "");';
			} else {
				return new Error('Attribute "name" or "src" is not defined.');
			}
		}
	};
})();