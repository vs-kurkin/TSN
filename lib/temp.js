var _localBlock = {};
var _block = {
	"b-menu": function () {

	},
	"b-menu_header": function (__stack) {

	}
};

var _data = {};
var _blankBlock = function () {};

var __template = {
	"/page/page.xml": function () {
		var _path = '/page/page.xml';
		_block['b-menu_header'].call(this, __stack);
	},
	"/blocks/b-menu/b-menu_header.xml": function () {
		var _localBlock = {};
		_localBlock['b-menu-after'] = function () {

		};

		_block['b-menu_header'].call(this, __stack, {
			"b-menu-after": _localBlock['b-menu-after']
		});

	}
};

__stack.write("\n\n\n	<html xmlns=\"http://www.w3.org/1999/xhtml\">\n    \n        " + String(this) + "\n        " + String(this) + "\n        " + String(this) + "\n        ");
(_localBlock["CSS"] || _block["CSS"] || _blankBlock).call(this, __stack);
__stack.write("\n        <head xmlns=\"http://www.w3.org/1999/xhtml\">\n            " + String(this) + "\n        </head>\n    \n		<body>\n			<div class=\"wrapper\">\n				");
(_localBlock["CONTENT"] || _block["CONTENT"] || _blankBlock).call(this, __stack);
__stack.write("\n			</div>\n			");
(_localBlock["JS"] || _block["JS"] || _blankBlock).call(this, __stack);
__stack.write("\n		</body>\n	</html>\n");