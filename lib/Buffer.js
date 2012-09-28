var TEN = module.parent.parent.exports;

module.exports = function (buffer, template, stream) {
	var newBuffer = [];

	newBuffer.parent = buffer;
	newBuffer.template = template;
	newBuffer.wait = 0;
	newBuffer.stream = stream;
	newBuffer.end = end;

	if (buffer) {
		newBuffer.parentIndex = buffer.length;
		buffer.length++;
		buffer.wait++;
	} else {
		newBuffer.parentIndex = 0;
	}

	return newBuffer;
};

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