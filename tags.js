/**
 * @fileOverview Описание тегов шаблонизатора TSN.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @version 1.1 beta
 */

var TSN = module.parent.exports;

this['root'] = {};

this['context'] = (function () {
	function fromData() {
		this.attribute.context = this.attribute.data;
	}

	function fromVar(template) {
		template.context = template['var'][this.attribute['var']];
	}

	return {
		parse: function () {
			if (this.attribute.hasOwnProperty('data')) {
				this['in'] = fromData;
			} else if (this.attribute.hasOwnProperty('var')) {
				this['in'] = fromVar;
			} else {
				return new Error('Attribute "data" or "var" is not defined.');
			}
		}
	};
})();

this['var'] = (function () {
	function fromData(template) {
		template['var'][this.attribute.name] = template.context[this.attribute.data];
		return false;
	}

	function fromText(template) {
		template['var'][this.attribute.name] = this.text;
		this.text = '';
	}

	return {
		parse: function () {
			var attribute = this.attribute;
			if (!attribute.hasOwnProperty('name') || !attribute.name.length) {
				this['in'] = false;
			} else if (attribute.hasOwnProperty('data')) {
				this['in'] = fromData;
			} else {
				this['out'] = fromText;
			}
		},
		startRender: function () {
			this['var'] = {};
		},
		endRender: function () {
			delete this['var'];
		}
	};
})();

this['if'] = (function () {
	function fromData() {
		return this.result = template.context[this.attribute.data];
	}

	function fromContext() {
		return this.result = template.context;
	}

	return {
		parse: function () {
			this['in'] = this.attribute.hasOwnProperty('data') ? fromData : fromContext;
		},
		'out': function () {
			if (!this.result) {
				this.text = '';
			}

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
		template['var'][this.attribute.key] = this.currentProperty;
	}).toString().replace(fncRegExp, '$1');

	var setValue = (function (template) {
		template['var'][this.attribute.value] = this.result[this.currentProperty];
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

		delete template['var'][this.attribute.key];
		delete template['var'][this.attribute.value];

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

this['template'] = {
	parse: function (instance) {
		var attribute = this.attribute;

		if (!instance.hasOwnProperty('template')) {
			instance.template = {};
		}

		if (attribute.hasOwnProperty('name') && attribute.name.length) {
			instance.template[attribute.name] = this.children;
			return '';
		} else{
			return new Error('Attribute "name" or "src" is not defined.');
		}
	}
};

this['include'] = {
	parse: function (instance) {
		var attribute = this.attribute;

		if (attribute.hasOwnProperty('name')) {
			var name = String(attribute.name);

			if (instance.template.hasOwnProperty(name)) {
				this.children = instance.template[name];
			} else {
				return new Error('Template with the name "' + name + '" is not defined.')
			}
		} else if (attribute.hasOwnProperty('src')) {
			this.children = new TSN(attribute.src).children;
		} else {
			return new Error('Attribute "name" or "src" is not defined.');
		}
	}
};

this['anchor'] = (function () {
	var push = [].constructor.prototype.push;
	return {
		parse: function () {
			if (!this.attribute.hasOwnProperty('name') || !this.attribute.name.length) {
				this['in'] = false;
			}
		},
		startRender: function () {
			this.anchor = [];
			this.tempAnchor = {};
		},
		endRender: function (result) {
			var index = 0,
				anchor,
				parent = this.parent;

			while (anchor = this.anchor.pop()) {
				var text = anchor.data.join('');
				result = result.substr(0, anchor.pos) + text + result.substr(anchor.pos);
				index += text.length;
			}

			if (parent) {
				for (var name in this.tempAnchor) {
					if (this.tempAnchor.hasOwnProperty(name)) {
						anchor = this.tempAnchor[name];
						if (parent.anchor.hasOwnProperty(name)) {
							push.apply(parent.anchor[name].data, anchor.data);
						} else if (parent.tempAnchor.hasOwnProperty(name)) {
							push.apply(parent.tempAnchor[name].data, anchor.data);
						} else {
							parent.tempAnchor[anchor.name] = anchor;
						}
					}
				}
			}

			delete this.anchor;
			delete this.tempAnchor;

			return result;
		},
		'in': function (template) {
			var name = this.attribute.name,
				parent,
				anchor;

			if (template.tempAnchor.hasOwnProperty(name)) {
				anchor = template.tempAnchor[name];
				delete template.tempAnchor[name];
			} else {
				anchor = {
					name: name,
					data: []
				}
			}

			anchor.pos = template.text.length;
			parent = this.parent;
			while (parent) {
				anchor.pos += parent.text.length;
				parent = parent.parent;
			}

			template.anchor[name] = anchor;
			template.anchor.push(anchor);

			return false;
		}
	};
})();

this['set-anchor'] = {
	parse: function () {
		this['in'] = !this.attribute.hasOwnProperty('data');
	},
	'out': function (template) {
		var name = this.attribute.name,
			anchorData = this['in'] ? this.text : template.context[this.attribute.data];

		if (template.anchor.hasOwnProperty(name)) {
			template.anchor[name].data.push(anchorData);
		} else if (template.tempAnchor.hasOwnProperty(name)) {
			template.tempAnchor[name].data.push(anchorData);
		} else {
			template.tempAnchor[name] = {
				name: name,
				data: [anchorData]
			};
		}

		this.text = '';
	}
};