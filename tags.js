/**
 * @fileOverview Описание тегов шаблонизатора TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.1 beta
 */

var TSN = module.parent.exports;

this['root'] = {};

this['comment'] = {
	parse: function () {
		return '';
	}
};

this['context'] = (function () {
	function fromVar(instance) {
		instance.context = instance.cache[this.aName];
	}

	return {
		parse: function () {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('data')) {
				attribute.context = attribute.data;
			} else if (attribute.hasOwnProperty('var')) {
				this.aName = attribute['var'];
				this['in'] = fromVar;
			}
		}
	};
})();

this['echo'] = (function () {
	function fromData(instance) {
		this.text = String(instance[this.aType][this.aName]);
		return false;
	}

	return {
		parse: function () {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('data')) {
				this.aName = attribute.data;
				this.aType = 'context';
				this['in'] = fromData;
			} else if (attribute.hasOwnProperty('var')) {
				this.aName = attribute['var'];
				this.aType = 'cache';
				this['in'] = fromData;
			}

			this.children.length = 0;
		},
		'in': function (instance) {
			this.text = String(instance.context);
			return false;
		},
		entity: {
			attribute: 'data'
		}
	};
})();

this['var'] = (function () {
	function fromData(instance) {
		instance.cache[this.aName] = instance[this.aType][this.aData];
		return false;
	}

	function fromContent(instance) {
		instance.cache[this.aName] = this.text;
		this.text = '';
	}

	return {
		parse: function () {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('name')) {
				this.aName = attribute.name;

				if (attribute.hasOwnProperty('data')) {
					this.aData = attribute.data;
					this.aType = 'context';
					this['in'] = fromData;
				} else if (attribute.hasOwnProperty('var')) {
					this.aData = attribute['var'];
					this.aType = 'cache';
					this['in'] = fromData;
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
		return Boolean(instance[this.aType][this.aName]) === this.type;
	}

	return {
		parse: function () {
			var attribute = this.attribute;
			this.type = this.name === 'if';

			if (attribute.hasOwnProperty('data')) {
				this.aName = attribute.data;
				this.aType = 'context';
				this['in'] = fromData;
			} else if (attribute.hasOwnProperty('var')) {
				this.aName = attribute['var'];
				this.aType = 'cache';
				this['in'] = fromData;
			}
		},
		'in': function (instance) {
			return Boolean(instance.context) === this.type;
		}
	};
})();

(function (API) {
	function onInFor (instance) {
		this.data = instance[this.aType][this.aData];
		this.length = this.data.length;

		if (this.length) {
			this.context = instance.context;
			this.currentIndex = 1;
			this['in'] = onStep;
			this.index--;

			if (this.aKey) {
				instance.cache[this.aKey] = 0;
			}

			instance.context = this.data[0];
			return true;
		} else {
			delete this.data;
			delete this.length;

			return false;
		}
	}

	function onInEach (instance) {
		var data = instance[this.aType][this.aData];

		this.data = [];
		this.indexes = [];

		for (var property in data) {
			if (data.hasOwnProperty(property)) {
				this.data.push(data[property]);
				this.indexes.push(property);
			}
		}

		this.length = this.data.length;

		if (this.length) {
			this.index--;
			this['in'] = onStep;
			this.currentIndex = 1;
			this.context = instance.context;

			if (this.aKey) {
				instance.cache[this.aKey] = this.indexes[0];
			}

			instance.context = this.data[0];
			return true;
		} else {
			delete this.data;
			delete this.indexes;
			delete this.length;

			return false;
		}
	}

	function onStep (instance) {
		var currentIndex = this.currentIndex;

		if (currentIndex == this.length) {
			instance.context = this.context;

			this.index++;
			this['in'] = this.onIn;

			delete this.data;
			delete this.indexes;
			delete this.currentIndex;
			delete this.length;
			delete this.context;

			return false;
		} else {
			if (this.aKey) {
				instance.cache[this.aKey] = this.isFor ? currentIndex : this.indexes[currentIndex];
			}

			instance.context = this.data[currentIndex];

			this.currentIndex++;
			return true;
		}
	}

	API['for'] = API['each'] = {
		parse: function () {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('data')) {
				this.aData = attribute['data'];
				this.aType = 'context';
			} else if (attribute.hasOwnProperty('var')) {
				this.aData = attribute['var'];
				this.aType = 'cache';
			} else {
				return new Error('Attribute "data" or "var" in not defined.');
			}

			this.isFor = this.name == 'for';
			this['in'] = this.onIn = this.isFor ? onInFor : onInEach;

			if (attribute.hasOwnProperty('key')) {
				this.aKey = attribute.key;
			}
		}
	}
})(this);

(function (API){
	function Template() {
	}

	function init (instance) {
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
			var attribute = this.attribute,
				parent;

			if (attribute.hasOwnProperty('name')) {
				var name = attribute.name;

				if (typeof name != 'string') {
					return new Error('Attribute "name" can not contain TSN-entity.');
				}

				if (instance.cache.template[name]) {
					this.children = instance.cache.template[name];
					delete this['in'];
					delete this['out'];
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
		'in': function (instance) {
			this.cache = instance.cache;
			instance.cache = {};
		},
		out: function (instance) {
			instance.cache = this.cache;
			delete this.cache;
		},
		entity: {
			attribute: 'name'
		},
		init: init
	};

})(this);