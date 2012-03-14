/**
 * @fileOverview Описание тегов шаблонизатора TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.1 beta
 */

var TSN = module.parent.exports;
var LIB = {
	path: require('path')
};

this['root'] = {};

this['context'] = (function () {
	function fromVar(instance) {
		instance.context = instance.cache['var'][this.aVar];
	}

	return {
		parse: function () {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('data')) {
				attribute.context = attribute.data;
			} else if (attribute.hasOwnProperty('var')) {
				this.aVar = attribute['var'];
				this['in'] = fromVar;
			}
		}
	};
})();

this['var'] = (function () {
	function fromData(instance) {
		instance.temp['var'][this.aName] = instance.context[this.aData];
		return false;
	}

	function fromVar(instance) {
		instance.temp['var'][this.aName] = instance.temp['var'][this.aVar];
		return false;
	}

	function fromContent(instance) {
		instance.temp['var'][this.aName] = this.text;
		this.text = '';
	}

	return {
		parse: function (instance) {
			var attribute = this.attribute;

			if (!instance.cache.hasOwnProperty('var')) {
				instance.cache['var'] = {};
			}

			if (attribute.hasOwnProperty('name')) {
				this.aName = attribute.name;

				if (attribute.hasOwnProperty('data')) {
					this.aData = attribute.data;
					this['in'] = fromData;
				} else if (attribute.hasOwnProperty('var')) {
					this.aVar = attribute['var'];
					this['in'] = fromVar;
				} else {
					this['out'] = fromContent;
				}
			} else {
				return new Error('Attribute "name" is not defined.');
			}
		}
	};
})();

this['if'] = this['unless'] = (function () {
	function fromData(instance) {
		return instance.context[this.aData] == this.type;
	}

	function fromVar(instance) {
		return instance.temp['var'][this.aVar] == this.type;
	}

	return {
		parse: function () {
			var attribute = this.attribute;
			this.type = this.name == 'if';

			if (attribute.hasOwnProperty('data')) {
				this.aData = attribute.data;
				this['in'] = fromData;
			} else if (attribute.hasOwnProperty('var')) {
				this.aVar = attribute['var'];
				this['in'] = fromVar;
			}
		},
		'in': function (instance) {
			return instance.context;
		},
		'out': function () {
			delete this.result;
		}
	};
})();

this['for'] = (function () {
	var toString = {}.constructor.prototype.toString,
		fncRegExp = /^function\s+[a-z]*\([^\)]*?\)\s*\{(?:\n|\r)?\s*([\s\S]*?)\}$/i;

	var getProperty = (function () {
		this.currentProperty = this.resultIsArray ? this.currentIndex : this.property[this.currentIndex];
	}).toString().replace(fncRegExp, '$1');

	var setKey = (function (template) {
		template.cache['var'][this.attribute.key] = this.currentProperty;
	}).toString().replace(fncRegExp, '$1');

	var setValue = (function (template) {
		template.cache['var'][this.attribute.value] = this.result[this.currentProperty];
	}).toString().replace(fncRegExp, '$1');

	var setContext = (function (template) {
		template.context = this.result[this.currentProperty];
	}).toString().replace(fncRegExp, '$1');

	var inListenerBase = (function () {
		if (++this.currentIndex == this.resultLength) {
			this['out'] = this.outListener;
		}
		return true;
	}).toString().replace(fncRegExp, '$1');

	function inListener(template) {
		var property;

		this.result = this.attribute.hasOwnProperty('data') ? template.context[this.attribute.data] : template.context;
		this.property = [];

		switch (toString.call(this.result)) {
			case '[object Array]':
				this.resultIsArray = true;
				this.resultLength = this.result.length;
				break;
			case '[object Object]':
				for (property in this.result) {
					this.property.push(property);
				}
				this.resultLength = this.property.length;
				break;
		}

		if (this.resultLength) {
			this.currentIndex = 0;
			this.index--;
			this['in'] = this.inListener;
			delete this['out'];
			this.inListener(template);
			return true;
		} else {
			delete this.resultIsArray;
			delete this.resultLength;
			delete this.result;
			delete this.property;
			return false;
		}
	}

	function outListener(template) {
		this.index++;
		delete this.resultIsArray;
		delete this.currentIndex;
		delete this.resultLength;
		delete this.result;
		delete this.property;
		delete this.currentProperty;

		delete template.cache['var'][this.attribute.key];
		delete template.cache['var'][this.attribute.value];

		this['in'] = inListener;
		delete this['out'];
	}

	return {
		parse: function () {
			this.outListener = outListener;
			var codeListener = getProperty;

			if (this.attribute.hasOwnProperty('key')) {
				codeListener += setKey;
			}

			if (!this.attribute.hasOwnProperty('context')) {
				codeListener += this.attribute.hasOwnProperty('value') ? 'template.context = ' + setValue : setContext;
			} else if (this.attribute.hasOwnProperty('value')) {
				codeListener += setValue;
			}

			this.inListener = new Function('template', codeListener += inListenerBase);
		},
		'in': inListener
	};
})();

(function (API){
	function Template() {
	}

	function initTemplates (instance) {
		if (!instance.temp.hasOwnProperty('template')) {
			Template.prototype = 'parent' in instance ? instance.parent.temp.template : {};
			instance.temp.template = new Template;
		}
	}

	API.template = {
		parse: function (instance) {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('name')) {
				initTemplates(instance);
				instance.temp.template[attribute.name] = this.children;
				return '';
			} else {
				return new Error('Attribute "name" is not defined.');
			}
		}
	};

	API.include = {
		parse: function (instance) {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('name')) {
				var name = String(attribute.name);

				initTemplates(instance);

				if (instance.temp.template[name]) {
					this.children = instance.temp.template[name];
				} else {
					return new Error('Template with the name "' + name + '" is not defined.')
				}
			} else if (attribute.hasOwnProperty('src')) {
				var parent = TSN.prototype.parent;

				TSN.prototype.parent = instance;
				this.template = new TSN(attribute.src);
				this.children = this.template.children;
				TSN.prototype.parent = parent;
			} else {
				return new Error('Attribute "name" or "src" is not defined.');
			}
		},
		'in': function (instance) {
			this.temp = instance.temp;
			instance.temp = this.template.cache;
		},
		out: function (instance) {
			instance.temp = this.temp;
			delete this.temp;
		}
	};

})(this);