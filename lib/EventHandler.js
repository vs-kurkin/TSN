var
	TEN = module.parent.parent.exports,
	CONST = require('./const.js'),
	Node = require('./Node.js'),
	nodeDefinition = require('./tags.js');

function EventHandler (config, API) {
	this.config = config;
	this.API = API;

	this.document = {
		type: CONST.TYPE_DOCUMENT_NODE,
		children: [],
		namespaces: Object.create(null),
		state: CONST.STATE_CODE,
		code: '',
		initCode: ''
	};

	this.document.current = this.document;
}

EventHandler.prototype.onStartDocument = function () {
	var
		code,
		nodeName,
		document = this.document;

	for (nodeName in nodeDefinition) {
		if (nodeDefinition.hasOwnProperty(nodeName) && nodeDefinition[nodeName].hasOwnProperty('start')) {
			code = nodeDefinition[nodeName].start(document, this.API, TEN);

			if (typeof code == 'string') {
				document.code += code;
			}
		}
	}
};

EventHandler.prototype.onEndDocument = function () {
	var
		code,
		nodeName,
		document = this.document;

	switch (document.state) {
		case CONST.STATE_TEXT:
			document.code += '");';
			break;
	}

	document.state = CONST.STATE_CODE;

	for (nodeName in nodeDefinition) {
		if (nodeDefinition.hasOwnProperty(nodeName) && nodeDefinition[nodeName].hasOwnProperty('end')) {
			code = nodeDefinition[nodeName].end(document, this.API, TEN);

			if (typeof code == 'string') {
				document.code += code;
			}
		}
	}
};

EventHandler.prototype.onStartElementNS = function (parser, elem, attrs, prefix) {
	var
		document = this.document,
		node = new Node(parser, elem, attrs, prefix, this, document.current);

	document.current.children.push(node);
	document.current = node;
};

EventHandler.prototype.onEndElementNS = function () {
	var
		result,
		error,
		document = this.document,
		config = this.config,
		currentNode = document.current,
		code,
		newState;

	document.current = currentNode.parent;

	if (currentNode.namespace === NS) {
		if (nodeDefinition.hasOwnProperty(currentNode.name)) {
			result = currentNode.fixAttributes();

			if (result instanceof Error) {
				error = result.message;
			} else {
				result = typeof currentNode.parse === 'function' ? currentNode.parse(document, config, this.API, TEN) : true;

				if (result instanceof Error) {
					error = result.message;
				} else {
					code = currentNode.compile(config);

					if (currentNode.initCode === true) {
						document.initCode += code;
					} else {
						switch (currentNode.templateType) {
							case CONST.TEMPLATE_TYPE_TEXT:
								newState = CONST.STATE_TEXT;
								break;

							case CONST.TEMPLATE_TYPE_CODE:
								newState = CONST.STATE_CODE;
								break;

							case CONST.TEMPLATE_TYPE_INHERIT:
								newState = currentNode.state;
								break;

							default:
								newState = CONST.STATE_CODE;
						}

						switch (currentNode.parent.state) {
							case CONST.STATE_TEXT:
								if (newState !== CONST.STATE_TEXT) {
									code = '");' + code;
								}
								break;
						}

						if (!currentNode.parent.firstState) {
							currentNode.parent.firstState = newState;
						}

						currentNode.parent.state = newState;
						currentNode.parent.code += code;
					}

					return;
				}
			}
		} else {
			error = 'Unknown tag.';
		}
	}

	if (error) {
		error = new Error(error);

		error.nodeName = currentNode.name;
		error.line = currentNode.line;
		error.column = currentNode.column;
		error.TemplatePath = config.path;
		error.TypeError = 'CompileError';

		TEN.emit('error', error);
	}

	// Output of the code is not valid tag or the HTML tag
	currentNode.value = currentNode.toString();
	currentNode.type = CONST.TYPE_TEXT_NODE;

	this.onText(currentNode, false);
};

EventHandler.prototype.onCharacters = function (parser, chars) {
	var current = this.document.current;

	this.onText({
		type: CONST.TYPE_TEXT_NODE,
		parent: current,
		value: chars,
		index: current.children.length
	}, true);
};

EventHandler.prototype.onCdata = function (parser, cdata) {
	var current = this.document.current;

	this.onText({
		type: CONST.TYPE_CDATA_SECTION_NODE,
		parent: current,
		value: cdata,
		index: current.children.length
	}, true);
};

EventHandler.prototype.onComment = function (parser, comment) {
	var current = this.document.current;

	if (this.config.saveComments === true) {
		this.onText({
			type: CONST.TYPE_COMMENT_NODE,
			parent: current,
			value: '<!--' + comment + '-->',
			index: current.children.length
		}, true);
	}
};

EventHandler.prototype.onText = function (node, needFix) {
	var
		text = node.value,
		parent = node.parent;

	if (text === '' || (/^\s+$/).test(text)) {
		return;
	} else {
		text = text.replace(/^\s+([^\s]+)\s+$/, '$1');
	}

	if (needFix) {
		text = text
			.replace(/\\/g, '\\\\')
			.replace(/("|')/g, '\\$1')
			.replace(/(?:\r\n)|\r|\n/g, '\\n')
			.replace(/\f/g, '\\f')
			.replace(/\u2028/g, '\\u2028')
			.replace(/\u2029/g, '\\u2029');
	}

	if (!parent.firstState) {
		parent.firstState = CONST.STATE_TEXT;
	}

	parent.children.push(node);

	switch (parent.state) {
		case CONST.STATE_CODE:
			text = '__buffer.push("' + text;
			break;
	}

	parent.state = CONST.STATE_TEXT;

	parent.code += text;
};

EventHandler.prototype.onError = function (msg) {
	console.log(msg);
};