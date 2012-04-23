# TSN 2.0.2 #
https://github.com/B-Vladi/TSN/

Templating System for Node.JS.

## Лицензия
MIT: https://github.com/appendto/amplify/blob/master/MIT-LICENSE.txt

## Описание
TSN - синхронный шаблонизатор, реализован в виде <a href="http://nodejs.org/api/modules.html">модуля</a> для NodeJS.


<b>Основные характеристики:</b>
* <b>Простота</b> - управляющие конструкции имеют стандартный XML-синтаксис. Выражения, используемые в значениях атрибутов тегов TSN, являются JavaScript-выражениями.
* <b>Скорость</b> - <a href="https://github.com/B-Vladi/TSN/tree/master/benchmark">тест производительности</a> показывает, что TSN быстрее похожего шаблонизатора <a href="https://github.com/mailru/fest">Fest</a> от Mail.ru, который в свою очередь <a href="https://github.com/vflash/FestLB?">быстрее</a> известного шаблонизатора <a href="http://ctpp.havoc.ru/">CTPP</a>. Так же TSN выигрывает в производительности <a href="http://akdubya.github.com/dustjs">Dust</a>, но этот тест не сохранился.
* <b>Гибкость шаблонов</b> - достигается за счет использования <a href="https://github.com/B-Vladi/TSN/wiki/Tags#wiki-tsn.var">внутренних переменных</a> и динамического подставления контекста.
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
var template = TSN.load('path/to/template.xml'); // Компиляция относительно TSN.config.templateRoot.
```

Использование имени шаблона:

```js
var template = TSN.load('path/to/template.xml', 'My name');
console.log(template.name === 'My name'); // true
console.log(TSN.cache['My name'] === template); // true
```

Компиляция шаблона с использованием собственных настроек. Параметры, которые не были указаны в этом объекте, будут унаследованы от `TSN.config`.

```js
var template = TSN.load('path/to/template.xml', null, {
	templateRoot: 'path/to/new/template/root'
});
```

Компиляция шаблона из данных:

```js
TSN.compile('<tsn:root xmlns:tsn="TSN">Text data</tsn:root>');
```

###Примеры рендеринга шаблона.

С использованием API:

```js
var result = TSN.render(template, data);
```

Без использования:

```js
var result = template.call(data);
```

Документация по API находится в вики: https://github.com/B-Vladi/TSN/wiki/API.
<br />
Так же вы можете сгенерировать JSDoc документацию по API из исходников (файл <a href="https://github.com/B-Vladi/TSN/blob/master/TSN.js">TSN.js</a>).

###Контекст данных.
Для доступа к данным из JavaScript-выражений используется понятие контекст. Контекстом является обычный JavaScript контекст в функциях. Т.е. необходимо использовать ключевое слово this, для обращения к текущему контексту.

###Теги
TSN использует теги в качестве управляющих конструкций в шаблоне, поэтому они должны быть правильными с точки зрения синтаксиса XML. TSN-теги должны иметь префикс пространства имен (настраивается в <a href="https://github.com/B-Vladi/TSN/blob/master/config.json">конфигурационном файле</a>, либо через <a href="https://github.com/B-Vladi/TSN/wiki/API#wiki-.config">API</a>).

В значениях атрибутов тегов TSN можно использовать следующие XML-сущности: `&amp; &lt; &gt; &quot; &apos;`.

Описание тегов и примеры: https://github.com/B-Vladi/TSN/wiki/Tags

<hr />
По всем вопросам отвечу по почте: b-vladi@cs-console.ru.