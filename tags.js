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
	var format = {
		text: 'String(/*text*/)',
		json: 'JSON.stringify(/*text*/)'
	};

	var escape = {
		js: '.replace(/(\'|"|(?:\\r\\n)|\\r|\\n|\\\\)/g, "\\\\$1")',

		url: 'encodeURI(/*text*/)',

		html: '' +
			'.replace(/&/g, "&amp;")' +
			'.replace(/</g, "&lt;")' +
			'.replace(/>/g, "&gt;")' +
			'.replace(/\"/g, "&quot;")',

		htmlDec: '' +
			'.replace(/&/g, "&#38;")' +
			'.replace(/</g, "&#60;")' +
			'.replace(/>/g, "&#62;")' +
			'.replace(/\"/g, "&#34;")',

		htmlHex: '' +
			'.replace(/&/g, "&#x26;")' +
			'.replace(/</g, "&#x3c;")' +
			'.replace(/>/g, "&#x3e;")' +
			'.replace(/\"/g, "&#x22;")'
	};

	return {
		parse: function () {
			var attributes = this.attributes;
			var template = attributes.hasOwnProperty('data') ? attributes.data : 'this';

			if (!attributes.hasOwnProperty('format')) {
				attributes.format = 'text';
			}

			if (format.hasOwnProperty(attributes.format)) {
				template = format[attributes.format].replace('/*text*/', template);
			} else {
				return Error('Invalid value of "' + attributes.escape + '" attribute "format"');
			}

			if (attributes.hasOwnProperty('escape')) {
				if (escape.hasOwnProperty(attributes.escape)) {
					template += escape[attributes.escape];
				} else {
					return Error('Invalid value of "' + attributes.escape + '" attribute "escape"');
				}
			}

			this.template = template;
		},
		inline: true
	};
})();

this['data'] = {
	start: function () {
		return 'var __data = TSN.hasOwnProperty("parent") ? TSN.parent.__data : {};';
	},
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('key')) {
			return new Error('Attribute "key" is not defined.');
		}

		if (!attributes.hasOwnProperty('value')) {
			this.template = '' +
				'(function (__output, __text, __hasStream) {' +
					'/*!code*/' +
					'return __output;' +
				'}).call(/*!context*/, "", "", false)';
		}

		switch (attributes.action) {
			case 'append':
				this.template = '(__data["/*@key*/"] || "") + ' + this.template;
				break;
			case 'prepend':
				this.template = this.template + ' + (__data["/*@key*/"] || "")';
				break;
			case 'replace':
		}

		this.template = '__data["/*@key*/"] = ' + this.template + ';';
	},
	template: 'String(/*@value*/)'
};

this['if'] = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('test')) {
			this.attributes.test = 'this';
		}
	},
	template: '' +
		'if (/*@expr*/) {' +
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

this['each'] = {
	parse: function () {
		var attributes = this.attributes;
		var hasItem = attributes.hasOwnProperty('item');

		if (attributes.hasOwnProperty('array')) {
			this.template = '' +
				'(function (_array) {' +
					'var _length = _array.length;' +
					'var _index = 0;' +
					'while (_index < _length) {' +
						(hasItem ? 'var /*@item*/ = _array[_index];' : '') +
						'/*!code*/' +
						'_index++;' +
					'}' +
				'}).call(/*!context*/, /*@array*/);';
		} else if (attributes.hasOwnProperty('object')) {
			this.template = '' +
				'(function (_object) {' +
					'for (var _property in _object) {' +
						'if (_object.hasOwnProperty(_property)) {' +
							(hasItem ? 'var /*@item*/ = _object[_property];' : '') +
							'/*!code*/' +
						'}' +
					'}' +
				'}).call(/*!context*/, /*@object*/);';
		} else {
			return new Error('Attribute "array" or "object" is not defined.');
		}
	}
};

(function (API) {
	var path = require('path');

	function escape (text) {
		return text.replace(/('|"|(?:\r\n)|\r|\n|\\)/g, "\\$1");
	}

	API.block = {
		parse: function () {
			var attributes = this.attributes;

			if (attributes.hasOwnProperty('name')) {
				var name = escape(attributes.name);

				if (name === '') {
					return new Error('Attribute "name" is empty.');
				} else {
					switch (attributes.type) {
						case 'default':
							this.template = ';' +
								'if (!__block.hasOwnProperty("' + name + '")) {' +
									'__block["' + name + '"] = ' + this.template +
								'}';
							break;
						case 'local':
							this.template = ';' +
								'__localBlock["' + name + '"] = ' + this.template;
							break;
						case 'global':
						default:
							this.template = ';' +
								'__block["' + name + '"] = ' + this.template;
					}
				}
			} else {
				return new Error('Attribute "name" is not defined.');
			}
		},
		template: '' +
			'function (__output, __text, __hasStream) {' +
				'/*!code*/;' +
				'return __output;' +
			'};'
	};

	API.render = {
		start: function () {
			return '' +
				'var __block = TSN.hasOwnProperty("parent") ? TSN.parent.__block : {};' +
				'var __localBlock = {};';
		},
		parse: function (parser) {
			var attributes = this.attributes;

			if (attributes.hasOwnProperty('file')) {
				if (attributes.file.charAt(0) !== '/') {
					if (!parser.config.hasOwnProperty('path')) {
						parser.config.path = parser.config.templateRoot;
					}

					attributes.file = path.relative(parser.config.templateRoot, path.resolve(parser.config.path, attributes.file));
				}

				if (!attributes.hasOwnProperty('config')) {
					attributes.config = 'null';
				}

				this.template = ';' +
					'TSN.parent = {' +
						'__block: __block,' +
						'__data: __data' +
					'};' +
					'__output += TSN' +
						'.load("/*@file*/", /*@config*/)' +
						'.call(/*!context*/, __stream);' +
					'delete TSN.parent;';

			} else if (attributes.hasOwnProperty('block')) {
				var blockName = escape(attributes.block);

				this.template = ';' +
					'__output += ' +
					'(__localBlock.hasOwnProperty("' + blockName + '") ? ' +
						'__localBlock["' + blockName + '"] : ' +
						'__block["' + blockName + '"])' +
							'.call(/*!context*/, "", "", __hasStream);';
			} else {
				return new Error('Attribute "block" or "file" is not defined.');
			}
		}
	};
})(this);

this.script = {
	parse: function () {
		this.template = this.text;
	}
};