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
		json: 'JSON.stringify(/*text*/)'
	};

	var escape = {
		js: '(/*text*/).replace(/(\'|"|(?:\\r\\n)|\\r|\\n|\\\\)/g, "\\\\$1")',
		decAll: '(/*text*/).replace(' + regExpAll + ', ' + getDec + ')',
		decHtml: '(/*text*/).replace(' + regExpHTML + ', ' + getDec + ')',
		hexAll: '(/*text*/).replace(' + regExpAll + ', ' + getHex + ')',
		hexHtml: '(/*text*/).replace(' + regExpHTML + ', ' + getHex + ')',
		hexUrl: 'encodeURI(/*text*/)',
		hexUrlAll: 'encodeURIComponent(/*text*/)'
	};

	return {
		parse: function () {
			var attributes = this.attributes;
			var text = attributes.hasOwnProperty('text') ? attributes.text : 'this';

			if (attributes.hasOwnProperty('type') && type.hasOwnProperty(attributes.type)) {
				text = type[attributes.type].replace('/*text*/', text);
			}

			if (attributes.hasOwnProperty('escape') && escape.hasOwnProperty(attributes.escape)) {
				text = escape[attributes.escape].replace('/*text*/', text);
			}

			this.body = '__output += (' + text + ');';
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
					';return __output;' +
				'}).call(/*!context*/, "");';
		}
	},
	body: 'var/*@name*/ = /*@value*/;'
};

this['entity'] = {
	init: function () {
		return 'var __entity = {};';
	},
	parse: function () {
		if (!this.attributes.hasOwnProperty('name')) {
			return new Error('Attribute "name" is not defined.');
		}

		if (!this.attributes.hasOwnProperty('value')) {
			this.body = '' +
				'__entity./*@name*/ = (function (__output) {' +
					'/*!code*/' +
					';return __output;' +
				'}).call(/*!context*/, "");';
		}
	},
	body: '__entity./*@name*/ = /*@value*/;'
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
			'var _item;' +
			'while (_index < _length) {' +
				'_item = _array[_index++];' +
				'/*!code*/' +
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
