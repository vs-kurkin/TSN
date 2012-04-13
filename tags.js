/**
 * @fileOverview Описание тегов шаблонизатора TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 2.0.1 beta
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
		js: '(/*text*/).replace(/(\'|"|(?:\\r\\n)|\\r|\\n|\\\\)/g, "\\\\$1")',
		html: '(/*text*/).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/\'/g, "&apos;")',
		htmlDec: '(/*text*/).replace(/&/g, "&#38;").replace(/</g, "&#60;").replace(/>/g, "&#62;").replace(/\"/g, "&#34;").replace(/\'/g, "&#39;")',
		htmlHex: '(/*text*/).replace(/&/g, "&#x26;").replace(/</g, "&#x3c;").replace(/>/g, "&#x3e;").replace(/\"/g, "&#x22;").replace(/\'/g, "&#x27;")',
		url: 'encodeURI(/*text*/)'
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

			parser.addedText = true;
			this.body = ' + (' + text + ')';
		}
	};
})();

this['var'] = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('name')) {
			return new Error('Attribute "name" is not defined.');
		}

		if (!attributes.hasOwnProperty('value')) {
			this.body = '' +
				'var /*@name*/ = (function (__output) {' +
					'/*!code*/' +
					'return __output;' +
				'}).call(/*!context*/, "");';
		}
	},
	body: 'var /*@name*/ = /*@value*/;'
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
		if (!this.attributes.hasOwnProperty('array')) {
			this.attributes.array = 'this';
		}
	},
	body: '' +
		'(function (_array) {' +
			'var _length = _array.length;' +
			'var _index = 0;' +
			'while (_index < _length) {' +
				'/*!code*/' +
				'_index++;' +
			'}' +
		'}).call(/*!context*/, /*@array*/);'
};

this['each'] = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('object')) {
			this.attributes.object = 'this';
		}
	},
	body: '' +
		'(function (_object) {' +
			'for (var _property in _object) {' +
				'if (_object.hasOwnProperty(_property)) {' +
					'/*!code*/' +
				'}' +
			'}' +
		'}).call(/*!context*/, /*@object*/);'
};

function Template () {}

this.template = {
	parse: function (parser) {
		if (this.attributes.hasOwnProperty('name')) {
			parser._template[this.attributes.name] = '' +
				'(function () {' +
					this.code +
				'}).call(/*!context*/);';
		} else {
			return new Error('Attribute "name" is not defined.');
		}
	},
	body: ''
};

this.include = {
	init: function (parser) {
		var prototype = parser.constructor.prototype;

		if (!prototype.hasOwnProperty('_template')) {
			prototype._template = {};
		}
	},
	parse: function (parser) {
		var attributes = this.attributes;
		var prototype;
		var template;

		if (attributes.hasOwnProperty('src')) {
			prototype = parser.constructor.prototype;
			Template.prototype = prototype._template;
			prototype._template = new Template;
			template = module.parent.exports.load(attributes.src);
			prototype._template = Object.getPrototypeOf(prototype._template);

			parser.addedText = true;
			this.body = ' + (function () {' + template.source + '}).call(/*!context*/)';
		} else if (attributes.hasOwnProperty('name')) {
			if (parser._template[attributes.name]) {
				this.body = parser._template[attributes.name];
			} else {
				return new Error('Template with the name "' + attributes.name + '" is not defined.');
			}
		} else {
			return new Error('Attribute "name" or "src" is not defined.');
		}
	}
};