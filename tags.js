/**
 * @fileOverview Описание тегов шаблонизатора TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.1 beta
 */

var TSN = module.parent.exports;

function fixExprAttribute () {
	if (!this.attributes.hasOwnProperty('expr') || this.attributes.expr === '') {
		this.attributes.expr = 'this';
	}
}

this.root = {
	body: '/*!code*/'
};

this['comment'] = {
	body: ''
};

this.context = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('expr')) {
			this.body = '/*!code*/';
		}
	},
	body: '' +
		'(function () {' +
			'/*!code*/' +
		'}).call(/*@expr*/);',
	attribute: {
		body: '' +
			'(function () {' +
				'/*!code*/' +
			'}).call(/*@*/);'
	}
};

this.echo = (function () {
	var regExpHTML = '/[&<>"\']/g';
	var regExpAll = '/[^a-z0-9\\-_\\.]/gi';

	var getDec = '' +
		'function (char) {' +
			'return "&#" + char.charCodeAt(0) + ";";' +
		'}';

	var getHex = '' +
		'function (char) {' +
			'return "&#x" + char.charCodeAt(0).toString(16) + ";";' +
		'}';

	var type = {
		json: 'JSON.stringify(/*expr*/)'
	};

	var escape = {
		js: '(/*expr*/).replace(/(\'|"|(?:\\r\\n)|\\r|\\n|\\\\)/g, "\\\\$1")',
		decAll: '(/*expr*/).replace(' + regExpAll + ', ' + getDec + ')',
		decHtml: '(/*expr*/).replace(' + regExpHTML + ', ' + getDec + ')',
		hexAll: '(/*expr*/).replace(' + regExpAll + ', ' + getHex + ')',
		hexHtml: '(/*expr*/).replace(' + regExpHTML + ', ' + getHex + ')',
		hexUrl: 'encodeURI(/*expr*/)',
		hexUrlAll: 'encodeURIComponent(/*expr*/)'
	};

	return {
		parse: function () {
			var attributes = this.attributes;
			var expr = attributes.hasOwnProperty('expr') ? attributes.expr : 'this';

			if (attributes.hasOwnProperty('type') && type.hasOwnProperty(attributes.type)) {
				expr = type[attributes.type].replace('/*expr*/', expr);
			}

			if (attributes.hasOwnProperty('escape') && escape.hasOwnProperty(attributes.escape)) {
				expr = escape[attributes.escape].replace('/*expr*/', expr);
			}

			this.body = '__output += (' + expr + ');';
		},
		entity: ['expr', 'type', 'escape']
	};
})();

this['var'] = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('name')) {
			return new Error('Attribute "name" is not defined.');
		}

		if (!this.attributes.hasOwnProperty('expr')) {
			this.body = '' +
				'var /*@name*/ = (function (__output) {' +
					'/*!code*/' +
					';return __output;' +
				'}).call(/*!context*/, "");';
		}
	},
	body: 'var/*@name*/ = /*@expr*/;'
};

this['if'] = {
	parse: fixExprAttribute,
	body: '' +
		'if (/*@expr*/) {' +
			'/*!code*/' +
		'}'
};

this.unless = {
	parse: fixExprAttribute,
	body: '' +
		'if (!(/*@expr*/)) {' +
			'/*!code*/' +
		'}'
};

this['for'] = {
	parse: fixExprAttribute,
	body: '' +
		'(function (_array) {' +
			'var _length = _array.length;' +
			'var _index = 0;' +
			'var _item;' +
			'while (_index < _length) {' +
				'_item = _array[_index++];' +
				'/*!code*/' +
			'}' +
		'}).call(/*!context*/, /*@expr*/);'
};

this['each'] = {
	parse: fixExprAttribute,
	body: '' +
		'(function (_object) {' +
			'for (var _property in _object) {' +
				'if (_object.hasOwnProperty(_property)) {' +
					'/*!code*/' +
				'}' +
			'}' +
		'}).call(/*!context*/, /*@expr*/);'
};

/*
(function (API) {
	function Template() {
	}

	function init(instance) {
		if (!instance.cache.hasOwnProperty('template')) {
			Template.prototype = ('parent' in instance) ? instance.parent.cache.template : {};
			instance.cache.template = new Template;
		}
	}

	API.template = {
		parse: function (instance) {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('name')) {
				if (typeof attribute.name == 'string') {
					instance.cache.template[attribute.name] = this.children;
					return '';
				} else {
					return new Error('Attribute "name" can not contain TSN-entity.');
				}
			} else {
				return new Error('Attribute "name" is not defined.');
			}
		},
		init: init
	};

	API.include = {
		parse: function (instance) {
			var attribute = this.attribute, parent;

			if (attribute.hasOwnProperty('name')) {
				var name = attribute.name;

				if (typeof name != 'string') {
					return new Error('Attribute "name" can not contain TSN-entity.');
				}

				if (instance.cache.template[name]) {
					this.children = instance.cache.template[name];
					delete this.input;
					delete this.output;
				} else {
					return new Error('Template with the name "' + name + '" is not defined.')
				}
			} else if (attribute.hasOwnProperty('src')) {
				if (typeof attribute.src != 'string') {
					return new Error('Attribute "src" can not contain TSN-entity.');
				}

				parent = TSN.prototype.parent;
				TSN.prototype.parent = instance;
				this.template = new TSN(attribute.src);
				this.children = this.template.children;
				TSN.prototype.parent = parent;
			} else {
				return new Error('Attribute "name" or "src" is not defined.');
			}
		},
		input: function (instance) {
			this.cache = instance.cache;
			instance.cache = {};
		},
		output: function (instance) {
			instance.cache = this.cache;
			delete this.cache;
		},
		entity: ['name', 'src'],
		init: init
	};

})(this);*/
