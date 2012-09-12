var TEN = module.parent.parent.exports;

function Stack (stack, template, stream) {
	this.parent = stack;
	this.template = template;
	this.queue = [];
	this.wait = 0;
	this.stream = stream;

	if (stack) {
		this.index = stack.queue.length;
		stack.queue.length++;
		stack.wait++;
	} else {
		this.index = 0;
	}
}

Stack.prototype.end = function (callback) {
	var parent = this.parent;
	var result;

	if (typeof this.callback !== 'function') {
		this.callback = callback;
	}

	if (this.wait === 0) {
		result = this.queue.join('');

		if (typeof this.callback === 'function') {
			this.callback(result);
		}

		if (parent) {
			delete this.parent;
			delete this.queue;

			parent.wait--;
			parent.queue[this.index] = result;

			return parent.end();
		} else if (this.template) {
			TEN.emit('renderEnd', result, this.template);

			if (this.stream) {
				this.stream.write(result);
				this.stream.end();
			}
		}

		return result;
	}
};

module.exports = Stack;