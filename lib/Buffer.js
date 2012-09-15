var TEN = module.parent.parent.exports;

function Stack (stack, template, stream) {
	var newStack = [];

	newStack.parent = stack;
	newStack.template = template;
	newStack.wait = 0;
	newStack.stream = stream;
	newStack.end = end;

	if (stack) {
		newStack.parentIndex = stack.length;
		stack.length++;
		stack.wait++;
	} else {
		newStack.parentIndex = 0;
	}

	return newStack;
}

function end(callback) {
	var
		parent = this.parent,
		result;

	if (typeof this.callback !== 'function') {
		this.callback = callback;
	}

	if (this.wait === 0) {
		result = this.join('');

		if (typeof this.callback === 'function') {
			this.callback(result);
		}

		if (parent) {
			delete this.parent;

			parent.wait--;
			parent[this.parentIndex] = result;

			return parent.end(null);
		} else if (this.template) {
			TEN.emit('renderEnd', result, this.template);

			if (this.stream) {
				this.stream.write(result);
				this.stream.end();
			}
		}

		return result;
	}

	return '';
}

module.exports = Stack;