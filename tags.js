/**
 * @fileOverview Реализация лигики тегов TEN.
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
	template: '/*!code*/',
	isEcho: false
};

this['comment'] = {
	template: '',
	isEcho: false
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
		'}).call(/*@object*/);',
	isEcho: false
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
		isEcho: true
	};
})();

this['data'] = {
	start: function () {
		return 'var _data = TEN.hasOwnProperty("parent") ? TEN.parent._data : {};';
	},
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('key')) {
			return new Error('Attribute "key" is not defined.');
		}

		if (!attributes.hasOwnProperty('action')) {
			attributes.action = 'replace';
		}

		this.template = attributes.hasOwnProperty('value') ? 'String(/*@value*/)' : 'result';

		switch (attributes.action) {
			case 'append':
				this.template = '(_data["/*@key*/"] || "") + ' + this.template + ';';
				break;
			case 'prepend':
				this.template = this.template + ' + (_data["/*@key*/"] || "");';
				break;
			case 'replace':
				this.template = this.template + ';';
				break;
			default:
				return new Error('Invalid value of attribute "action"');
		}

		if (attributes.hasOwnProperty('value')) {
			this.template = '_data["/*@key*/"] = ' + this.template;
		} else {
			this.template = '' +
				'(function (__stack) {' +
					'__stack.on("end", function (result) {' +
						'_data["/*@key*/"] = ' + this.template +
					'});' +

					'/*!code*/' +

					'__stack.end();' +
				'}).call(/*!context*/, new __Stack());';
		}
	},
	isEcho: false
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
		'}',
	isEcho: false
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
	isEcho: false
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
	},
	isEcho: false
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
							this.template = '' +
								'if (!_block.hasOwnProperty("' + name + '")) {' +
									'_block["' + name + '"] = ' + this.template +
								'}';
							break;
						case 'wrapper':
							this.template = '' +
								'_localBlock["' + name + '"] = _block["' + name + '"];' +
								'_block["' + name + '"] = ' + this.template;
							break;
						case 'local':
							this.template = '' +
								'_localBlock["' + name + '"] = ' + this.template;
							break;
						case 'global':
							this.template = '' +
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
				'/*!code*/' +
			'};',
		isEcho: false
	};

	API.render = {
		start: function () {
			return '' +
				'var _block = TEN.hasOwnProperty("parent") ? TEN.parent._block : {};' +
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

				this.template = '' +
					'TEN.parent = {' +
						'_block: _block,' +
						'_data: _data' +
					'};' +

					'TEN' +
						'.compileFile("/*@file*/", /*@config*/)' +
						'.render(/*!context*/, __stack);' +

					'delete TEN.parent;';

			} else if (attributes.hasOwnProperty('block')) {
				var blockName = escape(attributes.block);

				this.template = '' +
					'(_localBlock.hasOwnProperty("' + blockName + '") ? ' +
						'_localBlock["' + blockName + '"] : ' +
						'_block["' + blockName + '"])' +
							'.call(/*!context*/, __stack);';
			} else {
				return new Error('Attribute "block" or "file" is not defined.');
			}
		},
		isEcho: false
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
				this.template = '' + text + '';
				break;
			case 'local':
				parser.isEcho = false;

				this.isEcho = true;
				this.template = '' +
					'((function () {' +
						text +
					'}).call(/*!context*/) || "")';
				break;
			default:
				return new Error('')
		}
	},
	isEcho: false
};

this.header = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('value')) {
			this.template = '' +
				'(function (__stack) {' +
					'__stack.on("end", function (result) {' +
						'__stream.setHeader("/*@name*/", result);' +
					'});' +

					'/*!code*/' +

					'__stack.end();' +
				'}).call(/*!context*/, new __Stack())';
		}
	},
	template: '' +
		'__stream.setHeader("/*@name*/", "/*@value*/");',
	isEcho: false
};

this.status = {
	template: '' +
		'__stream.statusCode = Number(/*@code*/);',
	isEcho: false
};

this.query = {
	parse: function () {
		var attributes = this.attributes;

		if (!attributes.hasOwnProperty('method')) {
			return new Error('Attribute "method" is not defined.');
		}

		if (attributes.hasOwnProperty('arguments')) {
			attributes.arguments += ',';
		} else {
			attributes.arguments = '';
		}

		if (!attributes.hasOwnProperty('params')) {
			attributes.params = '';
		}

		if (!attributes.hasOwnProperty('context')) {
			attributes.context = 'null';
		}

		this.template = attributes.method + '(' + attributes.arguments + '(function (__stack) {' +
			'return function (' + attributes.params + ') {' +
				'/*!code*/' +
				'__stack.end();' +
			'};' +
		'})(new __Stack(__stack)));';
	},
	isEcho: false
};