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
			this.template = '' +
				'(function (__stack) {' +
					'__stack.on("end", function (result) {' +
						'__data["/*@key*/"] = result;' +
					'});' +

					'/*!code*/' +

					'__stack.end();' +
				'}).call(/*!context*/, new __Stack())';
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
						case 'wrapper':
							this.template = ';' +
								'_localBlock["' + name + '"] = _block["' + name + '"];' +
								'_block["' + name + '"] = ' + this.template;
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
			'function (__stack) {' +
				'/*!code*/;' +
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
					var cacheKey = parser.config.cacheKey;
					delete parser.config.cacheKey;

					attributes.config = parser.config.inheritConfig === true ? JSON.stringify(parser.config) : 'null';

					parser.config.cacheKey = cacheKey;
				}

				this.template = ';' +
					'TSN.parent = {' +
						'_block: _block,' +
						'_data: _data' +
					'};' +

					'__output += TSN' +
						'.compileFile("/*@file*/", /*@config*/)' +
						'.render(/*!context*/, __stream);' +

					'delete TSN.parent;';

			} else if (attributes.hasOwnProperty('block')) {
				var blockName = escape(attributes.block);

				this.template = ';' +
					'__output += ' +
					'(_localBlock.hasOwnProperty("' + blockName + '") ? ' +
						'_localBlock["' + blockName + '"] : ' +
						'_block["' + blockName + '"])' +
							'.call(/*!context*/, __stack);';
			} else {
				return new Error('Attribute "block" or "file" is not defined.');
			}
		},
		inline: false
	};
})(this);

this.script = {
	parse: function (parser) {
		var attributes = this.attributes;
		var text = this.text.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1');

		if (!attributes.hasOwnProperty('type')) {
			attributes.type = 'global';
		}

		switch (attributes.type) {
			case 'global':
				this.template = ';' + text + ';';
				break;
			case 'local':
				parser.inline = false;

				this.inline = true;
				this.template = '' +
					'((function () {' +
						text +
					'}).call(/*!context*/) || "")';
				break;
			default:
				return new Error('')
		}
	},
	inline: false
};

this.header = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('value')) {
			this.template = ';' +
				'(function (__stack) {' +
					'__stack.on("end", function (result) {' +
						'__stream.setHeader("/*@name*/", result);' +
					'});' +

					'/*!code*/' +

					'__stack.end();' +
				'}).call(/*!context*/, new __Stack())';
		}
	},
	template: ';' +
		'__stream.setHeader("/*@name*/", "/*@value*/");',
	inline: false
};

this.status = {
	template: ';' +
		'__stream.statusCode = Number(/*@code*/);',
	inline: false
};

this.query = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('method')) {
			return new Error('Attribute "method" is not defined.');
		}

		if (attributes.hasOwnProperty('param')) {
			attributes.param += ',';
		}

		if (!attributes.hasOwnProperty('context')) {
			attributes.context = 'null';
		}

		this.template = attributes.method + '(' + attributes.param + '(function (__stack) {' +
			'return function (' + attributes.arguments + ') {' +
				'/*!code*/' +
				'__stack.end();' +
			'};' +
		'})(new __Stack(__stack))));';
	},
	inline: false
};