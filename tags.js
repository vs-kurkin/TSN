/**
 * @author Влад Куркин (b-vladi@cs-console.ru)
 * @version 1.0 beta
 * @title Описание тегов шаблонизатора TSN.
 */

var TSN = module.parent.exports;

this['root'] = {};

this['echo'] = {
	'in': false,
	'out': function(node) {
		if (node.attribute.hasOwnProperty('expr')) {
			node.text = String(this.expression(node.attribute.expr));
		} else if (node.attribute.hasOwnProperty('var')) {
			node.text = this['var'][node.attribute['var']];
		} else {
			node.text = '';
		}
	}
};

this['var'] = {
	'in': function(node) {
		return node.attribute.hasOwnProperty('name') && !node.attribute.hasOwnProperty('value');
	},
	'out': function(node) {
		this['var'][node.attribute.name] = node.attribute.hasOwnProperty('expr') ? String(this.expression(node.attribute
			.expr)) : node.text;
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
		return node.isExpr = this.expression(node.attribute.expr);
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
				node.result = this.expression(node.attribute.expr);
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

			hasProperty = node.hasOwnProperty('currentProperty');
			if (hasProperty) {
				if (node.attribute.hasOwnProperty('key')) {
					this['var'][node.attribute.key] = node.currentProperty;
				}

				if (node.attribute.hasOwnProperty('value')) {
					this['var'][node.attribute.value] = node.result[node.currentProperty];
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
		}

		delete this['var'][node.attribute.key];
		delete this['var'][node.attribute.value];
	}
};

this['while'] = {
	'in': function(node) {
		var result = node.attribute.hasOwnProperty('expr') ? this.expression(node.attribute.expr) : false;
		if (node.hasOwnProperty('result')) {
			if (!result) {
				node.index++;
				delete node.result;
			}
		} else if (result) {
			node.index--;
			node.result = result;
		}

		return result;
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
			name = node.attribute.name,
			template;

		if (!isIncluded && typeof name == 'string' && name.length) {
			template = node.attribute.hasOwnProperty('src') && new TSN(node.attribute.src);
			this.template[name] = template instanceof TSN ? template : node;
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
		var template;
		if (node.hasOwnProperty('template')) {
			template = node.template;
			delete node.template;

			if (template instanceof TSN) {
				template.parent = this;
				node.text = template.render(node.attribute.hasOwnProperty('data') ? this.expression(node.attribute.data) : this
					.data);
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
				node.text = template.render(node.attribute.hasOwnProperty('data') ? this.expression(node.attribute.data) : this
					.data);
				delete template.parent;
			} else {
				node.text = '';
			}
		}
	}
};

this['anchor'] = (function(){
	var push = [].constructor.prototype.push;
	return {
		startRender: function(){
			this.anchor = [];
			this.tempAnchor = {};
		},
		endRender: function(result){
			var index = 0,
				anchor;

			while(anchor = this.anchor.pop()){
				var text = anchor.data.join('');
				result = result.substr(0, anchor.pos) + text + result.substr(anchor.pos);
				index += text.length;
			}

			if(this.parent){
				for(var name in this.tempAnchor){
					if(this.tempAnchor.hasOwnProperty(name)){
						anchor = this.tempAnchor[name];
						if(this.parent.anchor.hasOwnProperty(name)){
							push.apply(this.parent.anchor[name].data, anchor.data);
						} else if(this.parent.tempAnchor.hasOwnProperty(name)){
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
		'in': function(node){
			var name = node.attribute.name,
				parent,
				anchor;

			if(name){
				if(this.tempAnchor.hasOwnProperty(name)){
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
				while(parent){
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
	'out': function(node) {
		var name = node.attribute.name,
			anchorData = node.attribute.hasOwnProperty('value') ? String(this.expression(node.attribute.value)) : node.text;

		if (this.anchor.hasOwnProperty(name)) {
			this.anchor[name].data.push(anchorData);
		} else if(this.tempAnchor.hasOwnProperty(name)) {
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