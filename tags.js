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
					'var __hasStream = false;' +
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

		if (!(parent.name === 'if' || parent.name === 'unless')) {
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

(function (API) {
	var path = require('path');

	function escape(text) {
		return text.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1");
	}

	function addCode (parser) {
		if (parser.hasTemplates !== true) {
			parser.root.code += ';' +
				'function __Template () {}' +
				'__Template.prototype = TSN.parentTemplate;' +
				'var __template = new __Template;' +
				'delete TSN.parentTemplate;';

			parser.hasTemplates = true;
		}
	}

	API.template = {
		end: function (parser) {
			if (parser.parent) {
				return ';' +
					'__output += __text;' +
					'__hasStream && __text !== "" && __stream.write(__text, "' + parser.config.encoding + '");' +
					'__hasStream = false;'
			}
		},
		parse: function (parser) {
			var attributes = this.attributes;

			if (attributes.hasOwnProperty('name')) {
				if (attributes.name === '') {
					return new Error('Attribute "name" is empty.');
				} else {
					addCode(parser);

					this.template = '' +
						'__template["' + escape(attributes.name) + '"] = function (__output, __text) {' +
						this.code +
						';' +
						'__output += __text;' +
						'__hasStream && __text !== "" && __stream.write(__text, "' + parser.config.encoding + '");' +
						'; return __output;' +
						'};';
				}
			} else {
				return new Error('Attribute "name" is not defined.');
			}
		},
		template: ''
	};

	API.include = {
		parse: function (parser, TSN) {
			var attributes = this.attributes;
			var prototype;
			var template;

			addCode(parser);

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

				this.template = ';' +
					'TSN.parentTemplate = __template;' +
					'__output += TSN.cache["' + escape(template.cacheName) + '"].call(/*!context*/, __stream);';

			} else if (attributes.hasOwnProperty('name')) {
				this.template = ';__output += __template["' + escape(attributes.name) + '"].call(/*!context*/, "", "");';
			} else {
				return new Error('Attribute "name" or "src" is not defined.');
			}
		}
	};
})(this);