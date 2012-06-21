/**
 * @fileOverview Реализация лигики тегов TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

this.root = {
	parse: function () {
		if (this.attributes.hasOwnProperty('context')) {
			this.template = ';' +
				'(function () {' +
					'/*!code*/' +
				'}).call(/*!context*/);';
		}
	},
	template: '/*!code*/',
	inline: false
};

this['comment'] = {
	template: '',
	inline: false
};

this.context = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('object')) {
			this.template = '/*!code*/';
		}
	},
	template: ';' +
		'(function () {' +
			'/*!code*/' +
		'}).call(/*@object*/);',
	inline: false
};

this.echo = (function () {
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
			var template = 'String(' + (attributes.hasOwnProperty('data') ? attributes.data : 'this') + ')';

			if (attributes.hasOwnProperty('escape')) {
				if (escape.hasOwnProperty(attributes.escape)) {
					template += escape[attributes.escape];
				} else {
					return Error('Invalid value of attribute "escape"');
				}
			}

			this.template = template;
		},
		inline: true
	};
})();

this['data'] = {
	start: function () {
		return 'var _data = TSN.hasOwnProperty("parent") ? TSN.parent._data : {};';
	},
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('key')) {
			return new Error('Attribute "key" is not defined.');
		}

		if (!attributes.hasOwnProperty('action')) {
			attributes.action = 'replace';
		}

		if (!attributes.hasOwnProperty('value')) {
			this.template = ';' +
				'(function (__output, __text, __hasStream) {' +
					'/*!code*/' +
					'return __output;' +
				'}).call(/*!context*/, "", "", false)';
		}

		switch (attributes.action) {
			case 'append':
				this.template = '(_data["/*@key*/"] || "") + ' + this.template;
				break;
			case 'prepend':
				this.template = this.template + ' + (_data["/*@key*/"] || "")';
				break;
			case 'replace':
				break;
			default:
				return new Error('Invalid value of attribute "action"');
		}

		this.template = '_data["/*@key*/"] = ' + this.template + ';';
	},
	template: 'String(/*@value*/)',
	inline: false
};

this['if'] = {
	parse: function () {
		if (!this.attributes.hasOwnProperty('test')) {
			this.attributes.test = 'this';
		}
	},
	template: ';' +
		'if (/*@expr*/) {' +
			'/*!code*/' +
		'}',
	inline: false
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
	template: '} else {/*!code*/',
	inline: false
};

this['each'] = {
	parse: function () {
		var attributes = this.attributes;
		var hasItem = attributes.hasOwnProperty('item');

		if (attributes.hasOwnProperty('array')) {
			this.template = ';' +
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
	},
	inline: false
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
					if (!attributes.hasOwnProperty('type')) {
						attributes.type = 'global';
					}

					switch (attributes.type) {
						case 'default':
							this.template = ';' +
								'if (!_block.hasOwnProperty("' + name + '")) {' +
									'_block["' + name + '"] = ' + this.template +
								'}';
							break;
						case 'local':
							this.template = ';' +
								'_localBlock["' + name + '"] = ' + this.template;
							break;
						case 'global':
							this.template = ';' +
								'_block["' + name + '"] = ' + this.template;
							break;
						default:
							return new Error('Invalid value of attribute "type"');
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
			'};',
		inline: false
	};

	API.render = {
		start: function () {
			return '' +
				'var _block = TSN.hasOwnProperty("parent") ? TSN.parent._block : {};' +
				'var _localBlock = {};';
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
					delete parser.config.cacheKey;
					attributes.config = parser.config.inheritConfig === true ? JSON.stringify(parser.config) : 'null';
				}

				this.template = ';' +
					'TSN.parent = {' +
						'_block: _block,' +
						'_data: _data' +
					'};' +

					'__output += TSN' +
						'.compileFile("/*@file*/", /*@config*/)' +
						'.call(/*!context*/, __stream);' +

					'delete TSN.parent;';

			} else if (attributes.hasOwnProperty('block')) {
				var blockName = escape(attributes.block);

				this.template = ';' +
					'__output += ' +
					'(_localBlock.hasOwnProperty("' + blockName + '") ? ' +
						'_localBlock["' + blockName + '"] : ' +
						'_block["' + blockName + '"])' +
							'.call(/*!context*/, "", "", __hasStream);';
			} else {
				return new Error('Attribute "block" or "file" is not defined.');
			}
		},
		inline: false
	};
})(this);

this.script = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('type')) {
			attributes.type = 'global';
		}

		switch (attributes.type) {
			case 'global':
				this.template = this.text;
				this.inline = false;
				break;
			case 'local':
				this.template = ';' +
					'((function () {' +
						this.text +
					'}).call(/*!context*/) || "")';
				this.inline = true;
				break;
		}
	}
};

this.header = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('value')) {
			this.template = ';' +
				'__stream && __stream.setHeader("/*@name*/", (function (__output, __text, __hasStream) {' +
					'/*!code*/' +
					'return __output;' +
				'}).call(/*!context*/, "", "", false));';
		}
	},
	template: ';__stream && __stream.setHeader("/*@name*/", /*@value*/)',
	inline: false
};

this.status = {
	template: ';__stream && __stream.statusCode = Number(/*@value*/);',
	inline: false
};