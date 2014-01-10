var TEN = module.parent.exports;

function Options(options) {
	if (typeof options === 'object') {
		for (var property in Options.prototype) {
			if (Options.prototype.hasOwnProperty(property) && options.hasOwnProperty(property)) {
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
Options.prototype.namespace = 'ten';

/**
 * @name TEN.config.pathRoot
 * @description Корневая директория файлов шаблонов, относительно которой будут разрешаться пути.
 * @default ''
 * @type string
 */
Options.prototype.pathRoot = '';

/**
 * @name TEN.config.encoding
 * @description Кодировка файлов шаблонов.
 * @default 'utf-8'
 * @type string
 */
Options.prototype.encoding = 'utf-8';

Options.prototype.debug = false;

/**
 * @name TEN.config.saveComments
 * @description Если значение параметра false - HTML-комментарии будут удалены из результирующего кода шаблона. <a href="http://msdn.microsoft.com/en-us/library/ms537512(v=vs.85).aspx">Условные комментарии Internet Explorer</a> не будут удалены.
 * @default true
 * @type boolean
 */
Options.prototype.saveComments = true;

/**
 * @name TEN.config.cache
 * @description Разрешить или запретить кешировать скомпилированные шаблоны.
 * @default true
 * @type boolean
 */
Options.prototype.cache = true;

/**
 * @name TEN.config.inheritConfig
 * @description Флаг, указывающий на необходимость наследования кастомного объекта конфигурации {@link TEN.config}. Если значение параметра true - значением по-умолчанию атрибута <i>config</i> тега <i>render</i> будет конфиг текущего шаблона.
 * @default true
 * @type boolean
 */
Options.prototype.inheritConfig = true;

Options.prototype.API = {};

module.exports = Options;
