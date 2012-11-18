var _cache = {};
var __error;
var _blankBlock = function () {
};
var _block = {
	"b-menu": function (__stream, __stack) {

	},

	"b-menu_header": function (__stream, __stack, _localBlock) {
		(_localBlock["b-menu"] || _block["b-menu"] || _blankBlock).call(this, __stream, __stack);
	}
};

var _data = {};

+function (__stream, __stack) {
	try {
		__error = ['echo', 5, 2];
		__stack.write("\n\n\n	<html xmlns=\"http://www.w3.org/1999/xhtml\">\n    \n        " + (__error = ['echo', 5, 2], String(this)) + "\n        " + String(this) + "\n        " + String(this) + "\n        ");
		(_localBlock["b-menu_header"] || _block["b-menu_header"] || _blankBlock).call(this, __stream, __stack);
		__error = ['echo', 5, 2];
		__stack.write("\n        <head xmlns=\"http://www.w3.org/1999/xhtml\">\n            " + String(this) + "\n        </head>\n    \n		<body>\n			<div class=\"wrapper\">\n				");
		(_localBlock["b-menu"] || _block["b-menu"] || _blankBlock).call(this, __stream, __stack);
		__stack.write("\n			</div>\n			");
		(_localBlock["JS"] || _block["JS"] || _blankBlock).call(this, __stream, __stack);
		__stack.write("\n		</body>\n	</html>\n");
	} catch (error) {

	}

};
