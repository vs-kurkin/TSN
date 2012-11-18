/**
 * @fileOverview Парсер TEN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

var TEN = module.parent.exports,
	path = require('path'),
	Buffer = require(path.join(__dirname, 'Buffer.js')),
	xml = require(path.join(__dirname, 'SaxParser.js')),
	EventHandler = require(path.join(__dirname, 'EventHandler.js'));

/**
 * Компилятор TEN-шаблона.
 * @param {string} source Исходный код шаблона.
 * @param {object} config Объект конфигурации шаблона.
 * @returns {function} Скомпилированый шаблон.
 */
module.exports = function (source, config) {
	var
		arguments = [TEN, Buffer, __error],
		argumentsName = ['__TEN', '__Buffer', '__error'],
		API = {},
		/**
		 * @name template
		 * @namespace Объект скомпилированного шаблона TEN.
		 * @description Объект скомпилированного шаблона TEN.
		 */
		template,
		name,
		eventHandler = new EventHandler(config, API);

	for (name in config.API) {
		if (config.API.hasOwnProperty(name)) {
			API[name] = config.API[name];
		}
	}

	new xml.SaxParser(eventHandler).parseString(source);

	for (name in API) {
		if (API.hasOwnProperty(name)) {
			arguments.push(API[name]);
			argumentsName.push(name);
		}
	}

	argumentsName.push(
		'var' +
			'__attrIndex,' +
			'__TEN = this,' +
			'__path = "' + (typeof config.path === 'string' ? config.path.replace(/("|(?:\r\n)|\r|\n|\\)/g, '\\$1') : 'undefined') + '";' +
			eventHandler.document.initCode +
			'function __template(__stream, __buffer) {' +
				(eventHandler.document.code === '' ? '' : '"use strict";' +
					'var _context = this;' +
					'__buffer = new __Buffer(__buffer, __template, __stream);' +
					eventHandler.document.code +
					'return __buffer.end();') +
			'}' +
		'return __template;');

	try {
		template = Function
			.apply(null, argumentsName) // Make wrapper
			.apply(TEN, arguments); // Run wrapper
	} catch (error) {
		error.TemplatePath = config.path;
		error.TypeError = 'CompileError';

		TEN.emit('error', error);
		return null;
	}

	/**
	 * @name template.render
	 * @type function
	 * @description Рендеринг шаблона.
	 * @param {object} [context=undefined] Контекст шаблона.
	 * @param {object} [stream=undefined] <a href="http://nodejs.org/docs/latest/api/stream.html#stream_writable_stream">Поток с возможностью записи</a>, в который будет записываться результат рендеринга.
	 * @returns {string} Результат рендеринга.
	 * @example
	 * <pre>
	 *   template.render({}, stream);
	 * </pre>
	 */
	template.render = template.call;

	/**
	 * @name template.path
	 * @type string
	 * @description Абсолютный путь, по которому был скомпилирован шаблон, если он был скомпилирован из файла. Это свойство доступно после наступления события {@link TEN#event:compileEnd}.
	 */
	template.path = config.path;

	return template;
};

function __error (error, template, buffer, name, line, column) {
	error.templatePath = template.path;
	error.TypeError = 'RenderError';
	error.nodeName = name;
	error.line = line;
	error.column = column;

	TEN.emit('error', error, template);

	if (buffer) {
		buffer.push('<h3>RenderError:<br /> ' + error.toString() + '<br />Template: ' + template.path + '<br />Node name: ' + name + '<br />Line: ' + line + '<br />Column: ' + column + '</h3>');
	}
}