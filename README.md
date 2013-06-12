# TEN 1.0 #
https://github.com/B-Vladi/TEN/

Template Engine for NodeJS.

## Лицензия
MIT: https://github.com/appendto/amplify/blob/master/MIT-LICENSE.txt

## Описание
TEN - шаблонизатор, реализован в виде <a href="http://nodejs.org/api/modules.html">модуля</a> для NodeJS.

<b>Зависимости:</b>
* <a href="http://nodejs.org/docs/latest/api/path.html">Path</a>
* <a href="http://nodejs.org/docs/latest/api/fs.html">File System</a>
* <a href="http://nodejs.org/docs/latest/api/events.html">Events</a>

<b>Основные характеристики:</b>
* <b>Простота</b> - управляющие конструкции имеют стандартный XML-синтаксис. Выражения, используемые в значениях атрибутов тегов TEN, являются JavaScript-выражениями.
* <b>Скорость</b> - TEN быстрее шаблонизатора <a href="https://github.com/mailru/fest">Fest</a> от Mail.ru, который в свою очередь <a href="https://github.com/vflash/FestLB?">быстрее</a> известного шаблонизатора <a href="http://ctpp.havoc.ru/">CTPP</a>. Так же TEN выигрывает в производительности <a href="http://akdubya.github.com/dustjs">Dust</a>, но этот тест не сохранился.
* <b>Гибкость шаблонов</b> - достигается за счет <a href="https://github.com/B-Vladi/TEN/wiki/Tags#wiki-ten.include">подключаемых шаблонов</a>, динамического контекста и многого другого.
* <b>Расширяемость</b> - реализация логики тегов вынесена в отдельный <a href="https://github.com/B-Vladi/TEN/blob/master/tags.js">файл</a>, в который легко можно добавлять собственные теги, используя API TEN. В скором будущем появится соответствующая страница в wiki.
* <b>Поддержка IDE</b> - благодаря XML-синтаксису управляющих конструкций шаблонизатора, можно использовать приемущества редакторов кода, как то: подсветка синтаксиса и Zen Coding. Так же легко настроить валидацию и автокомплит, если IDE поддерживает подключение пользовательских DTD-файлов. В этом случае достаточно настроить IDE на использование <a href="https://github.com/B-Vladi/TEN/blob/master/TEN.dtd">DTD-файла</a> тегов TEN и объявить префикс пространства имен в шаблоне.

###Конфигурация парсинга шаблонов.
В вики: https://github.com/B-Vladi/TEN/wiki/Configuration и в <a href="https://github.com/B-Vladi/TEN/blob/2.4.0/jsdoc/symbols/TEN.config.html">JSDoc</a>

###Инициализация.
```js
var TEN = require('TEN');
```

###Примеры компиляции шаблона.
Компиляция из файла:

```js
TEN.compileFromFile('path/to/template.xml'); // относительно TEN.config.pathRoot
```

Компиляция всех файлов в папке и подпапках:

```js
TEN.on('compileDirEnd', function (path) {
	console.log(this.config.pathRoot === path) // true
});

TEN.compileFromDir(/.*?\.xml$/); // компилировать только XML-файлы
```

Компиляция шаблона с использованием кастомных настроек. Параметры, которые не были указаны в этом объекте, будут унаследованы от `TEN.config`.

```js
var template = TEN.compileFromFile('path/to/template.xml', {
	pathRoot: 'path/to/new/template/root',
	name: 'My name'
});

console.log(template.cacheName === 'My name'); // true
console.log(TEN.cache['My name'] === template); // true
```

Компиляция шаблона из данных:

```js
TEN.compileFromSource('<ten:root xmlns:ten="TEN">Text data</ten:root>');
```

###Примеры рендеринга шаблона.

С использованием API:

```js
var result = TEN.render(template, context);
```

Без использования:

```js
var result = template.call(context);
```

Запись результата в поток:

```js
template.call(context, response);
```

Полная документация по API находится в <a href="https://github.com/B-Vladi/TEN/wiki/API">вики</a> и в <a href="https://github.com/B-Vladi/TEN/blob/2.4.0/jsdoc/index.html">JSDoc</a> .

###Контекст данных.
В JavaScript-выражениях переданные данные доступны в виде контекста через ключевое слово this.
<br />
Если TEN тег влияет на контекст, это затрагивает только его дочерних элементов.

###Теги
Управляющие конструкци TEN-шаблона представляют собой XML-теги с префиксом пространства имен `TEN`. Префикс может использоваться любой и настраивается в <a href="https://github.com/B-Vladi/TEN/blob/master/config.json">конфигурационном файле</a>, либо через <a href="https://github.com/B-Vladi/TEN/wiki/API#wiki-.config">API</a>.
TEN-парсер не учитывает XML-окружение, поэтому явно регистрировать префикс для постранства имен `TEN` не обязательно, но рекоммендуется для комфортной работы в IDE.

В значениях атрибутов тегов TEN могут использоваться следующие XML-сущности: `&amp; &lt; &gt; &quot; &apos;`.

Описание тегов с примерами использования в <a href="https://github.com/B-Vladi/TEN/wiki/Tags">вики</a>.
<hr />

###Пример Web-приложения
В папке example.

<hr />
По всем вопросам отвечу по почте: b-vladi@cs-console.ru.
