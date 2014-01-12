/**
 * @fileOverview Парсер TEN-шаблона.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 */

var
    TEN = module.parent.exports,
    path = require('path'),
    Buffer = require(path.join(__dirname, 'Buffer.js')),
    SaxParser = require(path.join(__dirname, 'parser.js')).SaxParser,
    EventHandler = require(path.join(__dirname, 'EventHandler.js'));

/**
 * Компилятор TEN-шаблона.
 * @param {TEN} ten Исходный код шаблона.
 * @param {string} source Исходный код шаблона.
 * @returns {Function} Скомпилированый шаблон.
 */
function compiler(ten, source) {
    var
        options = ten.options,
        args = [ten, Buffer, RenderError],
        argumentsName = ['__TEN', '__Buffer', '__RenderError'],
        API = {},
        /**
         * @name template
         * @namespace Объект скомпилированного шаблона TEN.
         * @description Объект скомпилированного шаблона TEN.
         */
            template,
        name,
        eventHandler = new EventHandler(options, API);

    for (name in options.API) {
        if (options.API.hasOwnProperty(name)) {
            API[name] = options.API[name];
        }
    }

    new SaxParser(eventHandler).parseString(source);

    for (name in API) {
        if (API.hasOwnProperty(name)) {
            args.push(API[name]);
            argumentsName.push(name);
        }
    }

    argumentsName.push(
        'var ' +
            '__attrIndex,' +
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
            .apply(ten, args); // Run wrapper
    } catch (error) {
        ten.emit('compileError', new CompileError(error, options.path));
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
}

function CompileError(error, path) {
    this.templatePath = path;
    this.message = error.message;
}

CompileError.NAME = 'CompileError';
CompileError.prototype = new Error();
CompileError.prototype.name = CompileError.NAME;

function RenderError(error, template, buffer, name, line, column) {
    this.templatePath = template.path;
    this.message = error.message;
    this.nodeName = name;
    this.line = line;
    this.column = column;

    TEN.emit('renderError', this, template);

    if (buffer) {
        buffer.push(this.toString());
    }
}

RenderError.NAME = 'RenderError';
RenderError.prototype = new Error();
RenderError.prototype.name = RenderError.NAME;
RenderError.prototype.toString = function () {
    return '' +
        '<h3>' +
        'RenderError:<br /> ' + Error.prototype.toString.call(this) +
        '<br />Template: ' + this.templatePath +
        '<br />Node name: ' + this.nodeName +
        '<br />Line: ' + this.line +
        '<br />Column: ' + this.column +
        '</h3>';
};

compiler.CompileError = CompileError;
compiler.RenderError = RenderError;

module.exports = compiler;