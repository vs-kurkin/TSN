var TEN = module.parent.parent.exports;

/**
 *
 * @param {buffer} parent
 * @param {function} template
 * @param {stream} stream
 * @constructor
 * @return {buffer}
 */
function Buffer (parent, template, stream) {
	this.parent = parent;
	this.template = template;
	this.wait = 0;
	this.stream = stream;
	this.callback = undefined;

	if (parent) {
		this.parentIndex = parent.length;
		parent.push('');
		parent.wait++;
	} else {
		this.parentIndex = 0;
	}

	return this;
}

Buffer.prototype = Object.create(Array.prototype);

/**
 *
 * @param {function} callback
 * @return {string}
 */
Buffer.prototype.end = function (callback) {
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
};

module.exports = Buffer;