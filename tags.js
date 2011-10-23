/**
 * @author Влад Куркин (b-vladi@cs-console.ru)
 * @version 1.0 beta
 * @title Описание тегов шаблонизатора TSN.
 */

var TSN = module.parent.exports;

this['root'] = {};

this['context'] = {
	'in': function(node) {
		var attribute = node.attribute;
		if (attribute.hasOwnProperty('data')) {
			attribute.context = attribute.data;
		} else if (attribute.hasOwnProperty('var')) {
			this.context = this['var'][attribute['var']];
		}
	}
};

this['echo'] = {
	'in': function(node) {
		if (node.attribute.hasOwnProperty('data')) {
			node.text = this.context[node.attribute.data];
		} else if (node.attribute.hasOwnProperty('var')) {
			node.text = this['var'][node.attribute['var']];
		} else {
			node.text = '';
		}

		return false;
	}
};

this['var'] = {
	'in': function(node) {
		var attribute = node.attribute;
		if (attribute.hasOwnProperty('name')) {
			if (attribute.hasOwnProperty('data')) {
				this['var'][attribute.name] = this.context[attribute.data];
				return false;
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
		var attribute = node.attribute;
		return !!(node.isExpr = attribute.hasOwnProperty('data') ? this.context[attribute.data] : this.context);
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
			var property,
				hasProperty,
				attribute = node.attribute;

			if (!node.hasOwnProperty('currentProperty')) {
				node.result = attribute.hasOwnProperty('data') ? this.context[attribute.data] : this.context;
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
				} else {
					delete node.resiltIsArray;
					delete node.currentIndex;
					delete node.resultLength;
					delete node.result;
					delete node.property;
					delete node.currentProperty;
				}
			}

			if (hasProperty = node.hasOwnProperty('currentProperty')) {
				if (attribute.hasOwnProperty('key')) {
					this['var'][attribute.key] = node.currentProperty;
				}

				if (attribute.hasOwnProperty('value')) {
					this['var'][attribute.value] = node.result[node.currentProperty];
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
			attribute = node.attribute,
			name = attribute.name;

		if (!isIncluded && typeof name == 'string' && name.length) {
			this.template[name] = attribute.hasOwnProperty('src') ? new TSN(attribute.src) : node;
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
			}
		} else {
			return false;
		}
	},
	'out': function(node) {
		var template,
			attribute = node.attribute,
			templateData;
		
		if (node.hasOwnProperty('template')) {
			template = node.template;
			delete node.template;

			if (template instanceof TSN) {
				template.parent = this;
				if(attribute.hasOwnProperty('context')){
					templateData = this['var'][attribute.context];
				} else if(attribute.hasOwnProperty('data')) {
					templateData = this.context[attribute.data];
				} else {
					templateData = this.context;
				}

				node.text = template.render(templateData);
				delete template.parent;
			} else {
				template.parent = template.realParent;
				delete template.realParent;
				delete node.template;
				delete node.children;
			}
		} else if (attribute.hasOwnProperty('src')) {
			template = new TSN(attribute.src);
			if (template instanceof TSN) {
				template.parent = this;
				template.parent = this;
				if (attribute.hasOwnProperty('context')) {
					templateData = this['var'][attribute.context];
				} else if (attribute.hasOwnProperty('data')) {
					templateData = this.context[attribute.data];
				} else {
					templateData = this.context;
				}

				node.text = template.render(templateData);
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