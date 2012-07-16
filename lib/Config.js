var TEN = module.parent.exports;

function Config(options) {
	for (var property in options) {
		if (options.hasOwnProperty(property)) {
			this[property] = options[property];
		}
	}
}

Config.prototype = TEN.config;
Config.prototype.constructor = Config;

module.exports = Config;

/**
 * @name TEN.config.namespace
 * @description Префикс пространства имен TEN.
 * @default 'ten'
 * @type string
 */

/**
 * @name TEN.config.templateRoot
 * @description Корневая директория файлов шаблонов, относительно которой будут разрешаться пути.
 * @default ''
 * @type string
 */

/**
 * @name TEN.config.encoding
 * @description Кодировка файлов шаблонов.
 * @default 'utf-8'
 * @type string
 */

/**
 * @name TEN.config.saveComments
 * @description Если значение параметра false - HTML-комментарии будут удалены из результирующего кода шаблона. <a href="http://msdn.microsoft.com/en-us/library/ms537512(v=vs.85).aspx">Условные комментарии Internet Explorer</a> не будут удалены.
 * @default true
 * @type boolean
 */

/**
 * @name TEN.config.parseCDATA
 * @description Если значение парамерта false - теги TEN не будут отрабатывать в секциях CDATA.
 * @default false
 * @type boolean
 */

/**
 * @name TEN.config.tabSize
 * @description Размер одного символа табуляции в пробелах (если используется символ табуляции).
 * @default 2
 * @type number
 */

/**
 * @name TEN.config.indent
 * @description Размер отступа в пробелах.
 * @default 2
 * @type number
 */

/**
 * @name TEN.config.cache
 * @description Разрешить или запретить кешировать скомпилированные шаблоны.
 * @default true
 * @type boolean
 */

/**
 * @name TEN.config.removeXMLDeclaration
 * @description Если значение параметра true - XML декларация и DTD в начале файла шаблона будут удалены.
 * @default true
 * @type boolean
 */

/**
 * @name TEN.config.inheritConfig
 * @description Флаг, указывающий на необходимость наследования кастомного объекта конфигурации {@link TEN.config}. Если значение параметра true - значением по-умолчанию атрибута <i>config</i> тега <i>render</i> будет конфиг текущего шаблона.
 * @default true
 * @type boolean
 */