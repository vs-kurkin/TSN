/**
 * @fileOverview Описание тегов шаблонизатора TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */
this.root = {
	parse: function () {
		if (this.attributes.hasOwnProperty('context')) {
			this.body = '' +
				'(function () {' +
					'/*!code*/' +
				'}).call(/*!context*/);';
		}
	},
	body: '/*!code*/'
};

this['comment'] = {
	body: ''
};

this.context = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('object')) {
			this.body = '/*!code*/';
		}
	},
	body: '' +
		'(function () {' +
			'/*!code*/' +
		'}).call(/*@object*/);'
};

this.echo = (function () {
	var type = {
		json: 'JSON.stringify(/*text*/)'
	};

	var escape = {
		js: '(/*text*/)' +
			'.replace(/(\'|"|(?:\\r\\n)|\\r|\\n|\\\\)/g, "\\\\$1")',

		url: 'encodeURI(/*text*/)',

		html: '(/*text*/)' +
			'.replace(/&/g, "&amp;")' +
			'.replace(/</g, "&lt;")' +
			'.replace(/>/g, "&gt;")' +
			'.replace(/\"/g, "&quot;")',

		htmlDec: '(/*text*/)' +
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

			this.body = '(' + text + ')';
		},
		inline: true
	};
})();

this['var'] = {
	start: function () {
		return 'var _var = {};';
	},
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('name')) {
			return new Error('Attribute "name" is not defined.');
		}

		if (!attributes.hasOwnProperty('value')) {
			this.body = '' +
				'_var["/*@name*/"] = (function (__output) {' +
					'/*!code*/' +
					'return __output;' +
				'}).call(/*!context*/, "");';
		}
	},
	body: '_var["/*@name*/"] = (/*@value*/);'
};

this['if'] = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('test')) {
			this.attributes.test = 'this';
		}
	},
	body: '' +
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
	body: '' +
		'if (!(/*@test*/)) {' +
			'/*!code*/' +
		'}'
};

this['for'] = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('array')) {
			attributes.array = 'this';
		}

		this.body = '' +
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

		this.body = '' +
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
		if (parser.hasTemplates === true) {
			return 'Template.prototype = Object.getPrototypeOf(Template.prototype);';
		}
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
				this.body = '__template["' + attributes.name + '"] = function () {' +
						this.code +
					'};';
			}
		} else {
			return new Error('Attribute "name" is not defined.');
		}
	},
	body: ''
};

this.include = (function () {
	var path = require('path');

	return {
		parse: function (parser) {
			var attributes = this.attributes;
			var prototype;
			var template;

			if (attributes.hasOwnProperty('src')) {
				prototype = parser.constructor.prototype;
				prototype.parent = parser;

				if (attributes.src.charAt(0) !== '/') {
					attributes.src = path.relative(parser.config.templateRoot, path.resolve(parser.config.path, attributes.src));
				}

				template = module.parent.exports.load(attributes.src, null, parser.config);

				delete prototype.parent;

				this.inline = true;
				this.body = '' + '(function () {' + template.source + '}).call(/*!context*/)';

			} else if (attributes.hasOwnProperty('name')) {
				this.body = '__template["' + attributes.name + '"].call(/*!context*/)';
			} else {
				return new Error('Attribute "name" or "src" is not defined.');
			}
		}
	};
})();