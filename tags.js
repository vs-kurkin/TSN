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
		instance.context = instance.temp['var'][this.aVar];
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

this['echo'] = (function () {
	function dataFromContext(instance) {
		this.text = instance.context[this.aData];
		return false;
	}

	function fromVar(instance) {
		this.text = instance.temp['var'][this.aVar];
		return false;
	}

	return {
		parse: function () {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('data')) {
				this.aData = attribute.data;
				this['in'] = dataFromContext;
			} else if (attribute.hasOwnProperty('var')) {
				this.aVar = attribute['var'];
				this['in'] = fromVar;
			}

			this.children.length = 0;
		},
		'in': function (instance) {
			this.text = instance.context;
			return false;
		},
		entity: {
			attribute: 'data'
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
		parse: function () {
			var attribute = this.attribute;

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
		},
		init: function (instance) {
			instance.cache['var'] = {};
		}
	};
})();

this['if'] = this['unless'] = (function () {
	function fromData(instance) {
		return Boolean(instance.context[this.aData]) === this.type;
	}

	function fromVar(instance) {
		return Boolean(instance.temp['var'][this.aVar]) === this.type;
	}

	return {
		parse: function () {
			var attribute = this.attribute;
			this.type = this.name === 'if';

			if (attribute.hasOwnProperty('data')) {
				this.aData = attribute.data;
				this['in'] = fromData;
			} else if (attribute.hasOwnProperty('var')) {
				this.aVar = attribute['var'];
				this['in'] = fromVar;
			}
		},
		'in': function (instance) {
			return Boolean(instance.context) === this.type;
		}
	};
})();

(function (API) {
	function onInFor (instance) {
		this.data = instance.context[this.aData];

		if (0 in this.data) {
			this.context = instance.context;
			this.currentIndex = 1;
			this['in'] = onStep;
			this.index--;

			if (this.aKey) {
				this['var'][this.aKey] = 0;
			}

			instance.context = this.data[0];
			return true;
		} else {
			delete this.data;

			return false;
		}
	}

	function onInEach (instance) {
		var data = instance.context[this.aData];

		this.data = [];
		this.indexes = [];

		for (var property in data) {
			if (data.hasOwnProperty(property)) {
				this.data.push(data[property]);
				this.indexes.push(property);
			}
		}

		if (0 in this.data) {
			this.index--;
			this['in'] = onStep;
			this.currentIndex = 1;
			this.context = instance.context;

			if (this.aKey) {
				this['var'][this.aKey] = this.indexes[0];
			}

			instance.context = this.data[0];
			return true;
		} else {
			delete this.data;
			delete this.indexes;

			return false;
		}
	}

	function onStep (instance) {
		var currentIndex = this.currentIndex;

		if (currentIndex in this.data) {
			if (this.aKey) {
				this['var'][this.aKey] = this.isFor ? currentIndex : this.indexes[currentIndex];
			}

			instance.context = this.data[currentIndex];

			this.currentIndex++;
			return true;
		} else {
			instance.context = this.context;

			this.index++;
			this['in'] = this.onIn;

			delete this.data;
			delete this.indexes;
			delete this.currentIndex;
			delete this.context;

			return false;
		}
	}

	API['for'] = API['each'] = {
		parse: function (instance) {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('data')) {
				this.aData = attribute.data;
				this['var'] = instance.cache['var'];
				this.isFor = this.name == 'for';
				this['in'] = this.onIn = this.isFor ? onInFor : onInEach;

				if (attribute.hasOwnProperty('key')) {
					this.aKey = attribute.key.toString();
				}
			} else {
				return new Error('Attribute "data" in not defined.');
			}
		}
	}
})(this);

(function (API){
	function Template() {
	}

	function init (instance) {
		if (!instance.temp.hasOwnProperty('template')) {
			Template.prototype = ('parent' in instance) ? instance.parent.temp.template : {};
			instance.temp.template = new Template;
		}
	}

	API.template = {
		parse: function (instance) {
			var attribute = this.attribute;

			if (attribute.hasOwnProperty('name')) {
				if (typeof attribute.name == 'string') {
					instance.temp.template[attribute.name] = this.children;
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

				if (instance.temp.template[name]) {
					this.children = instance.temp.template[name];
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
			this.temp = instance.temp;
			instance.temp = this.template.cache;
		},
		out: function (instance) {
			instance.temp = this.temp;
			delete this.temp;
		},
		entity: {
			attribute: 'name'
		},
		init: init
	};

})(this);