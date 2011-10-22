/**
 * @author Влад Куркин (b-vladi@cs-console.ru)
 * @version 1.0 beta
 * @title Описание тегов шаблонизатора TSN.
 */

var TSN = module.parent.exports;

this['root'] = {};

this['context'] = {
	'in': function(node) {
		if (node.hasOwnProperty('data')) {
			node.context = this.context[node.attribute.data];
		}
	}
};

this['echo'] = {
	'in': function(node) {
		if (node.attribute.hasOwnProperty('data')) {
			node.result = this.context[node.attribute.data];
		} else if (node.attribute.hasOwnProperty('var')) {
			node.result = this['var'][node.attribute['var']];
		} else {
			node.result = '';
		}
		return false;
	},
	'out': function(node) {
		node.text = node.result;
		delete node.result;
	}
};

this['var'] = {
	'in': function(node) {
		if (node.attribute.hasOwnProperty('name')) {
			if (node.attribute.hasOwnProperty('value')) {
				this['var'][node.attribute.name] = node.attribute.value;
				return false;
			} else if (node.attribute.hasOwnProperty('data')) {
				this['var'][node.attribute.name] = this.context[node.attribute.data];
				return false;
			} else if (node.attribute.hasOwnProperty('context')) {
				node.context = this['var'][node.attribute.context];
			}

			node.result = false;
		} else {
			return false;
		}
	},
	'out': function(node) {
		if (node.result === false) {
			this['var'][node.attribute.name] = node.text;
			delete node.result;
		}
		node.text = '';
	},
	startRender: function() {
		this['var'] = {};
	},
	endRender: function() {
		delete this['var'];
	}
};

this['if'] = {
	'in': function(node) {
		if (node.attribute.hasOwnProperty('context')) {
			node.context = this['var'][node.attribute.context];
		}

		return !!(node.isExpr = node.attribute.hasOwnProperty('data') ? this.context[node.attribute.data] : false);
	},
	out: function(node) {
		if (!node.isExpr) {
			node.text = '';
		}

		delete node.isExpr;
	}
};

this['for'] = {
	'in': (function() {
		var toString = {}.constructor.prototype.toString;

		return function(node) {
			var property, hasProperty;

			if (!node.hasOwnProperty('currentProperty')) {
				node.result = this.context[node.attribute.data];
				node.property = [];

				switch (toString.call(node.result)) {
					case '[object Array]':
						node.resiltIsArray = true;
						node.resultLength = node.result.length;
						node.currentProperty = 0;
						break;
					case '[object Object]':
						for (property in node.result) {
							node.property.push(property);
						}

						node.resultLength = node.property.length;
						node.currentProperty = node.property[0];
						break;
				}

				if (node.resultLength) {
					node.currentIndex = 0;
					node.index--;
					node.hasKeyAttr = node.attribute.hasOwnProperty('key');
					node.hasValueAttr = node.attribute.hasOwnProperty('value');
				} else {
					delete node.resiltIsArray;
					delete node.currentIndex;
					delete node.resultLength;
					delete node.result;
					delete node.property;
					delete node.currentProperty;
					delete node.hasKeyAttr;
					delete node.hasValueAttr;
				}
			}

			hasProperty = node.hasOwnProperty('currentProperty');
			if (hasProperty) {
				if (node.hasKeyAttr) {
					this['var'][node.attribute.key] = node.currentProperty;
				}

				if (node.hasValueAttr) {
					this['var'][node.attribute.value] = node.result[node.currentProperty];
				}

				if (node.attribute.context) {
					node.context = this['var'][node.attribute.context];
				}
			}

			return hasProperty;
		}
	})(),
	'out': function(node) {
		if (node.resultLength && ++node.currentIndex != node.resultLength) {
			node.currentProperty = node.resiltIsArray ? node.currentIndex : node.property[node.currentIndex];
		} else {
			node.index++;
			delete node.resiltIsArray;
			delete node.currentIndex;
			delete node.resultLength;
			delete node.result;
			delete node.property;
			delete node.currentProperty;
			delete node.hasKeyAttr;
			delete node.hasValueAttr;

			delete this['var'][node.attribute.key];
			delete this['var'][node.attribute.value];
		}
	}
};

this['template'] = {
	startRender: function() {
		this.template = {};
	},
	endRender: function() {
		delete this.template;
	},
	'in': function(node) {
		var isIncluded = node.isIncluded === true,
			name = node.attribute.name;

		if (isIncluded) {
			if (node.attribute.hasOwnProperty('context')) {
				node.context = this['var'][node.attribute.context];
			}
		} else if (typeof name == 'string' && name.length) {
			this.template[name] = node.attribute.hasOwnProperty('src') ? new TSN(node.attribute.src) : node;
		}

		return isIncluded;
	}
};

this['include'] = {
	parse: function(node) {
		if (TSN.config.parseIncluded === true && node.attribute.hasOwnProperty('src')) {
			new TSN(node.attribute.src);
		}
	},
	'in': function(node) {
		var tmplName = node.attribute.name;

		if (this.template.hasOwnProperty(tmplName)) {
			node.template = this.template[tmplName];

			if (!(node.template instanceof TSN)) {
				node.template.isIncluded = true;
				node.template.realParent = node.template.parent;
				node.template.parent = node.parent;
				node.children = [node.template];

				if (node.attribute.hasOwnProperty('context')) {
					node.context = this['var'][node.attribute.context];
				}
			}
		} else {
			return false;
		}
	},
	'out': function(node) {
		var template;
		if (node.hasOwnProperty('template')) {
			template = node.template;
			delete node.template;

			if (template instanceof TSN) {
				template.parent = this;
				node.text = template.render(node.attribute.hasOwnProperty('context') ? this['var'][node.attribute
					.context] : this.context);
				delete template.parent;
			} else {
				template.parent = template.realParent;
				delete template.realParent;
				delete node.template;
				delete node.children;
			}
		} else if (node.attribute.hasOwnProperty('src')) {
			template = new TSN(node.attribute.src);
			if (template instanceof TSN) {
				template.parent = this;
				node.text = template.render(node.attribute.hasOwnProperty('context') ? this['var'][node.attribute
					.context] : this.context);
				delete template.parent;
			} else {
				node.text = '';
			}
		}
	}
};

this['anchor'] = (function() {
	var push = [].constructor.prototype.push;
	return {
		startRender: function() {
			this.anchor = [];
			this.tempAnchor = {};
		},
		endRender: function(result) {
			var index = 0,
				anchor;

			while (anchor = this.anchor.pop()) {
				var text = anchor.data.join('');
				result = result.substr(0, anchor.pos) + text + result.substr(anchor.pos);
				index += text.length;
			}

			if (this.parent) {
				for (var name in this.tempAnchor) {
					if (this.tempAnchor.hasOwnProperty(name)) {
						anchor = this.tempAnchor[name];
						if (this.parent.anchor.hasOwnProperty(name)) {
							push.apply(this.parent.anchor[name].data, anchor.data);
						} else if (this.parent.tempAnchor.hasOwnProperty(name)) {
							push.apply(this.parent.tempAnchor[name].data, anchor.data);
						} else {
							this.parent.tempAnchor[anchor.name] = anchor;
						}
					}
				}
			}

			delete this.anchor;
			delete this.tempAnchor;

			return result;
		},
		'in': function(node) {
			var name = node.attribute.name,
				parent,
				anchor;

			if (name) {
				if (this.tempAnchor.hasOwnProperty(name)) {
					anchor = this.tempAnchor[name];
					delete this.tempAnchor[name];
				} else {
					anchor = {
						name: name,
						data: []
					}
				}

				anchor.pos = this.text.length;
				parent = this.parent;
				while (parent) {
					anchor.pos += parent.text.length;
					parent = parent.parent;
				}

				this.anchor[name] = anchor;
				this.anchor.push(anchor);
			}

			return false;
		}
	};
})();

this['set-anchor'] = {
	'in': function(node) {
		if (node.attribute.hasOwnProperty('data')) {
			node.result = this.context[node.attribute.data];
			return false;
		}

		if (node.attribute.hasOwnProperty('context')) {
			node.context = this['var'][node.attribute.context];
		}
	},
	'out': function(node) {
		var name = node.attribute.name,
			anchorData = node.hasOwnProperty('result') ? node.result : node.text;

		delete node.result;

		if (this.anchor.hasOwnProperty(name)) {
			this.anchor[name].data.push(anchorData);
		} else if (this.tempAnchor.hasOwnProperty(name)) {
			this.tempAnchor[name].data.push(anchorData);
		} else {
			this.tempAnchor[name] = {
				name: name,
				data: [anchorData]
			};
		}

		node.text = '';
	}
};