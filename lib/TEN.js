/**
 * @fileOverview Templating System for Node.JS.
 * @author <a href="mailto:b-vladi@cs-console.ru">Влад Куркин</a>
 * @startuml
 *
 * @enduml
 */

/**
 * @ignore
 */
var LIB = {
    fileSystem: require('fs'),
    path: require('path'),
    event: require('events')
};

var Options = require(LIB.path.join(__dirname, 'Options.js'));

/**
 * @name TEN
 * @constructor
 * @namespace Templating Engine for NodeJS.
 * @description Пространство имен API шаблонизатора, экземпляр <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.
 * @return TEN
 */
function TEN(options) {
    /**
     * @name TEN.config
     * @namespace Объект конфигурации {@link TEN}.
     * @description Объект конфигурации {@link TEN}. Значения по-умолчанию берутся из config.json.
     * @static
     * @type Object
     */
    this.options = new Options(options);

    /**
     * Кеш скомпилированных шаблонов. Имена ключей соответствуют абсолютным путям к файлам шаблонов. Пример использования в описании метода {@link TEN.compileFromFile}.
     * @type Object
     */
    this.pages = {};

    return this;
}

TEN.prototype = new LIB.event.EventEmitter();
TEN.prototype.constructor = TEN;

module.exports = TEN;

/**
 * Синхронная компиляция шаблона.
 * @param {string} source Исходный код шаблона.
 * @return {function} Скомпилированный шаблон {@link template}.
 * @example
 * <pre>
 * // Компиляция из исходного кода шаблона.
 * TEN.compileFromSource("&lt;ten:root xmlns:ten="TEN"&gt;Text&lt;/ten:root&gt;");
 *
 * // Компиляция с использованием кастомного конфига.
 * TEN.compileFromSource("&lt;ten:root xmlns:ten="TEN"&gt;Text&lt;/ten:root&gt;", {
 *   saveComments: true
 * });
 * </pre>
 */
TEN.prototype.compileFromSource = function (source) {
    var template = Compiler(this, source);

    if (template === null) {
        return null;
    }

    if (this.options.cache === true && typeof this.options.path === 'string') {
        this.pages[this.options.path] = template;
    }

    template.path = this.options.path;

    this.emit('compileEnd', template);

    return template;
};

/**
 * Синхронная компиляция шаблона из файла.
 * @param {string} path Путь к файлу шаблона относительно {@link TEN.config.pathRoot}.
 * @return {function} Скомпилированный шаблон {@link template}.
 * @example
 * <pre>
 *   // Компиляция файла /home/user/template.xml.
 *   TEN.config.pathRoot = '/home/user';
 *   TEN.compileFromFile('template.xml');
 *
 *   Компиляция с указанием кастомного конфига.
 *   var template = TEN.compileFromFile('template.xml', {
 *     removeXMLDeclaration: false
 *   });
 *   TEN.pages.CustomKey === template // true
 * </pre>
 */
TEN.prototype.compileFromFile = function (path) {
    var fullPath = LIB.path.join(this.options.pathRoot, path);
    var template;

    if (this.options.cache === true && this.pages.hasOwnProperty(fullPath)) {
        return this.pages[fullPath];
    }

    this.options.path = fullPath;
    this.options.dir = LIB.path.dirname(fullPath);

    template = this.compileFromSource(LIB.fileSystem.readFileSync(fullPath, this.options.encoding), this.options);

    this.emit('compileFileEnd', template);

    return template;
};

/**
 * Асинхронная рекурсивная компиляция файлов, включая вложенные дирректории.
 * @param {string|RegExp} [pattern=/.* /] Расширение файла (строка) либо ругелярное выражение, которому должно соответствовать полное имя файла для компиляции. После завершения компиляции вызывается событие {@link TEN#event:compileDirEnd}.
 * @example
 * <pre>
 *   // Компилировать только файлы с расширением .html.
 *   TEN.compileFromDir('html');
 *
 *   // Аналогично предыдущему вызову.
 *   TEN.compileFromDir(/.+?\.html$/);
 *
 *   // Компилировать все файлы в папке /home/user и подпапках.
 *   TEN.compileFromDir(null, {
 *     pathRoot: '/home/user'
 *   });
 * </pre>
 */
TEN.prototype.compileFromDir = function (pattern) {
    var ten = this;
    var options = this.options;
    var directory = {
        state: 'start',
        path: options.pathRoot,
        childDirsLength: 0
    };

    switch (typeof pattern) {
        case 'string':
            pattern = new RegExp('.*?\\.' + pattern + '$');
            break;
        case 'RegExp':
            break;
        default:
            pattern = /.*/;
    }

    function callback(error, data) {
        if (error) {
            error.TypeError = 'CompileDirError';
            ten.emit('error', error);
            return;
        }

        switch (directory.state) {
            case 'start':
                if (data.isDirectory()) {
                    directory.state = 'read';

                    LIB.fileSystem.readdir(directory.path, callback);
                } else {
                    error = new Error('Path ' + directory.path + ' is not a directory.');
                    error.TypeError = 'CompileDirError';

                    ten.emit('error', error);
                }
                break;
            case 'read':
                directory.files = data;
                directory.state = 'status';

                if (data.length) {
                    directory.currentFile = data.shift();

                    LIB.fileSystem.stat(LIB.path.join(directory.path, directory.currentFile), callback);
                } else {
                    callback(error, new LIB.fileSystem.Stats());
                }
                break;
            case 'status':
                var path = LIB.path.join(directory.path, directory.currentFile);

                if (data.isFile()) {
                    if (pattern.test(directory.currentFile)) {
                        options.pathRoot = directory.path;
                        ten.compileFromFile(LIB.path.relative(directory.path, path), options);
                    }
                } else if (data.isDirectory()) {
                    options.pathRoot = path;
                    var child = ten.compileFromDir(pattern, options);

                    child.root = directory.root || directory.path;
                    child.parent = directory;

                    directory.childDirsLength++;
                }

                if (directory.files.length) {
                    directory.currentFile = directory.files.shift();
                    LIB.fileSystem.stat(LIB.path.join(directory.path, directory.currentFile), callback);
                } else {
                    directory.state = 'end';

                    while (!directory.childDirsLength) {
                        if (directory.parent) {
                            directory = directory.parent;
                            directory.childDirsLength--;
                        } else if (directory.state === 'end') {
                            ten.emit('compileDirEnd', directory.root || directory.path);
                            break;
                        }
                    }

                }
                break;
        }
    }

    LIB.fileSystem.stat(this.options.pathRoot, callback);

    return directory;
};

/**
 * Рендеринг шаблона.
 * @param {string|function} page Скомпилированный шаблон {@link template} или путь к шаблону, относительно {@link TEN.config.templateRoot}. Если по относительному пути шаблон не был скомпилирован - он будет скомпилирован.
 * @param {object} [context=undefined] Контекст шаблона.
 * @param {object} [stream=undefined] <a href="http://nodejs.org/docs/latest/api/stream.html#stream_writable_stream">Поток с возможностью записи</a>, в который будет записываться результат рендеринга.
 * @return {text} Результат рендеринга, если не использовались асинхронные конструкции.
 * @example
 * <pre>
 *   TEN.config.pathRoot = '/home/user';
 *
 *   // Рендеринг шаблона из /home/user/template.xml.
 *   TEN.render('template.xml', context);
 *
 *   // Аналогично предыдущему вызову.
 *   TEN.compileFromFile('template.xml');
 *   TEN.render('template.xml', context);
 *
 *   // Аналогично предыдущему вызову.
 *   TEN.render(TEN.compileFromFile('template.xml'), context);
 * </pre>
 */
TEN.prototype.render = function (page, context, stream) {
    switch (typeof page) {
        case 'string':

            if (this.pages.hasOwnProperty(page)) {
                page = this.pages[page];
            } else {
                var path = LIB.path.join(this.config.pathRoot, page);
                page = this.compileFromFile(path);
            }
            break;

        case 'function':
            break;

        default:
            var error = new Error('First argument "page" must be type string or function.');
            error.TypeError = 'RenderError';

            this.emit('error', error);
    }

    return page.render(context, stream);
};

/**
 * Добавляет поддержку нового TEN-тега.
 * @param {string} name Имя тега.
 * @param {object} definition Объект API тега.
 */
TEN.prototype.extendDTD = function (name, definition) {
    tagsDefinition[name] = definition;
};

/**
 * @param {string|function} page
 * @return {boolean}
 */
TEN.prototype.hasPage = function (page) {
    var path;

    switch (typeof page) {
        case 'string':
            return this.pages.hasOwnProperty(LIB.path.join(this.config.pathRoot, page));

        case 'function':
            for (path in this.pages) {
                if (this.pages.hasOwnProperty(path) && this.pages[path] === page) {
                    return true;
                }
            }
            return false;

        default:
            return false;
    }
};

var Compiler = require(LIB.path.join(__dirname, 'Compiler.js'));
var tagsDefinition = require(LIB.path.join(__dirname, 'tags.js'));
/**
 * @event
 * @name TEN#error
 * @description Ошибка.
 * @param {error} error Объект ошибки.
 * @param {string} error.TypeError Тип ошибки:
 * <ul>
 *   <li><i>CompileError</i> - Ошибка компиляции. Объект ошибки этого типа имеет дополнительные свойства: <b>message</b>, <b>nodeName</b>, <b>line</b>, <b>char</b>.<br /><br /></li>
 *   <li><i>RenderError</i> - Ошибка рендеринга. Объект ошибки этого типа имеет дополнительное свойство <b>templateName</b>.<br /><br /></li>
 *   <li><i>CompileDirError</i> - Ошибка компиляции из директории {@link TEN.compileFromDir}.</li>
 * </ul>
 *
 * <div>
 *   <b>Дополнительные свойства:</b>
 * </div>
 * <br />
 * @param {string} error.message Текст ошибки.
 * @param {string} error.nodeName Имя тега, сгенерировавшего ошибку.
 * @param {number} error.line Номер строки, на которой находится тег, сгенерировавший ошибку.
 * @param {number} error.char Позиция символа в строке, с которого начинается тег, сгенерировавший ошибку.
 * @param {string} error.templateName Имя шаблона.
 */

/**
 * @event
 * @name TEN#compileEnd
 * @description Завершение компиляции шаблона методом {@link TEN.compileFromSource}.
 * @param {function} template Скомпилированный шаблон {@link template}.
 */

/**
 * @event
 * @name TEN#compileFileEnd
 * @description Завершение компиляции шаблона методом {@link TEN.compileFromFile}. Перед этим событием гинерируется событие {@link TEN#event:compileEnd}.
 * @param {function} template Скомпилированный шаблон {@link template}.
 */

/**
 * @event
 * @name TEN#compileDirEnd
 * @description Завершение компиляции шаблонов из директории методом {@link TEN.compileFromDir}.
 * @param {string} path Путь к директории, в которой компилировались шаблоны.
 */
