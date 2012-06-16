# TSN 2.3.4 #
https://github.com/B-Vladi/TSN/

Templating System for Node.JS.

## Лицензия
MIT: https://github.com/appendto/amplify/blob/master/MIT-LICENSE.txt

## Описание
TSN - синхронный шаблонизатор, реализован в виде <a href="http://nodejs.org/api/modules.html">модуля</a> для NodeJS.

<b>Зависимости:</b>
* <a href="http://nodejs.org/docs/latest/api/path.html">Path</a>
* <a href="http://nodejs.org/docs/latest/api/fs.html">File System</a>
* <a href="http://nodejs.org/docs/latest/api/events.html">Events</a>

<b>Основные характеристики:</b>
* <b>Простота</b> - управляющие конструкции имеют стандартный XML-синтаксис. Выражения, используемые в значениях атрибутов тегов TSN, являются JavaScript-выражениями.
* <b>Скорость</b> - TSN быстрее шаблонизатора <a href="https://github.com/mailru/fest">Fest</a> от Mail.ru, который в свою очередь <a href="https://github.com/vflash/FestLB?">быстрее</a> известного шаблонизатора <a href="http://ctpp.havoc.ru/">CTPP</a>. Так же TSN выигрывает в производительности <a href="http://akdubya.github.com/dustjs">Dust</a>, но этот тест не сохранился.
* <b>Гибкость шаблонов</b> - достигается за счет <a href="https://github.com/B-Vladi/TSN/wiki/Tags#wiki-tsn.include">подключаемых шаблонов</a>, динамического контекста и многого другого.
* <b>Расширяемость</b> - реализация логики тегов вынесена в отдельный <a href="https://github.com/B-Vladi/TSN/blob/master/tags.js">файл</a>, в который легко можно добавлять собственные теги, используя API TSN. В скором будущем появится соответствующая страница в wiki.
* <b>Поддержка IDE</b> - благодаря XML-синтаксису управляющих конструкций шаблонизатора, можно использовать приемущества редакторов кода, как то: подсветка синтаксиса и Zen Coding. Так же легко настроить валидацию и автокомплит, если IDE поддерживает подключение пользовательских DTD-файлов. В этом случае достаточно настроить IDE на использование <a href="https://github.com/B-Vladi/TSN/blob/master/TSN.dtd">DTD-файла</a> тегов TSN и объявить префикс пространства имен в шаблоне.

###Конфигурация парсинга шаблонов.
В вики: https://github.com/B-Vladi/TSN/wiki/Configuration

###Инициализация.
```js
var TSN = require('TSN');
```

###Примеры компиляции шаблона.
Компиляция из файла:

```js
TSN.compileFromFile('path/to/template.xml'); // Компиляция относительно TSN.config.templateRoot.
```

Компиляция всех файлов в папке и подпапках:

```js
TSN.compileFromDir(); // Компиляция относительно TSN.config.templateRoot.
```

Компиляция шаблона с использованием кастомных настроек. Параметры, которые не были указаны в этом объекте, будут унаследованы от `TSN.config`.

```js
var template = TSN.compileFromFile('path/to/template.xml', {
	templateRoot: 'path/to/new/template/root',
	name: 'My name'
});

console.log(template.cacheName === 'My name'); // true
console.log(TSN.cache['My name'] === template); // true
```

Компиляция шаблона из данных:

```js
TSN.compile('<tsn:root xmlns:tsn="TSN">Text data</tsn:root>');
```

###Примеры рендеринга шаблона.

С использованием API:

```js
var result = TSN.render(template, context);
```

Без использования:

```js
var result = template.call(context);
```

Запись результата в поток:

```js
template.call(context, response);
```

Полная документация по API находится в <a href="https://github.com/B-Vladi/TSN/wiki/API">вики</a> и в <a href="https://github.com/B-Vladi/TSN/jsdoc/index.html">JSDoc</a> .

###Контекст данных.
В JavaScript-выражениях переданные данные доступны в виде контекста через ключевое слово this.
<br />
Если TSN тег влияет на контекст, это затрагивает только его дочерних элементов.

###Теги
Управляющие конструкци TSN-шаблона представляют собой XML-теги с префиксом пространства имен `TSN`. Префикс может использоваться любой и настраивается в <a href="https://github.com/B-Vladi/TSN/blob/master/config.json">конфигурационном файле</a>, либо через <a href="https://github.com/B-Vladi/TSN/wiki/API#wiki-.config">API</a>.
TSN-парсер не учитывает XML-окружение, поэтому явно регистрировать префикс для постранства имен `TSN` не обязательно, но рекоммендуется для комфортной работы в IDE.

В значениях атрибутов тегов TSN могут использоваться следующие XML-сущности: `&amp; &lt; &gt; &quot; &apos;`.

Описание тегов с примерами использования в <a href="https://github.com/B-Vladi/TSN/wiki/Tags">вики</a>.
<hr />

###Пример Web-приложения
В папке example.

<hr />
По всем вопросам отвечу по почте: b-vladi@cs-console.ru.