var TEN = module.parent.exports;

function Config(options) {
	if (typeof options === 'object') {
		for (var property in Config.prototype) {
			if (Config.prototype.hasOwnProperty(property) && options.hasOwnProperty(property)) {
				this[property] = options[property];
			}
		}
	}

}

/**
 * @name TEN.config.namespace
 * @description Префикс пространства имен TEN.
 * @default 'ten'
 * @type string
 */
Config.prototype.namespace = 'ten';

/**
 * @name TEN.config.pathRoot
 * @description Корневая директория файлов шаблонов, относительно которой будут разрешаться пути.
 * @default ''
 * @type string
 */
Config.prototype.pathRoot = '';

/**
 * @name TEN.config.encoding
 * @description Кодировка файлов шаблонов.
 * @default 'utf-8'
 * @type string
 */
Config.prototype.encoding = 'utf-8';

Config.prototype.debug = false;

/**
 * @name TEN.config.saveComments
 * @description Если значение параметра false - HTML-комментарии будут удалены из результирующего кода шаблона. <a href="http://msdn.microsoft.com/en-us/library/ms537512(v=vs.85).aspx">Условные комментарии Internet Explorer</a> не будут удалены.
 * @default true
 * @type boolean
 */
Config.prototype.saveComments = true;

/**
 * @name TEN.config.cache
 * @description Разрешить или запретить кешировать скомпилированные шаблоны.
 * @default true
 * @type boolean
 */
Config.prototype.cache = true;

/**
 * @name TEN.config.inheritConfig
 * @description Флаг, указывающий на необходимость наследования кастомного объекта конфигурации {@link TEN.config}. Если значение параметра true - значением по-умолчанию атрибута <i>config</i> тега <i>render</i> будет конфиг текущего шаблона.
 * @default true
 * @type boolean
 */
Config.prototype.inheritConfig = true;

Config.prototype.API = {};

module.exports = Config;
