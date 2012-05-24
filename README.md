# TSN 2.3.3 #
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
* <b>Скорость</b> - <a href="https://github.com/B-Vladi/TSN/tree/master/benchmark">тест производительности</a> показывает, что TSN быстрее похожего шаблонизатора <a href="https://github.com/mailru/fest">Fest</a> от Mail.ru, который в свою очередь <a href="https://github.com/vflash/FestLB?">быстрее</a> известного шаблонизатора <a href="http://ctpp.havoc.ru/">CTPP</a>. Так же TSN выигрывает в производительности <a href="http://akdubya.github.com/dustjs">Dust</a>, но этот тест не сохранился.
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
var template = TSN.load('path/to/template.xml'); // Компиляция относительно TSN.config.templateRoot.
```

Использование имени шаблона:

```js
var template = TSN.load('path/to/template.xml', 'My name');

console.log(template.cacheName === 'My name'); // true
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

Запись результата в поток:

```js
template.call(data, response);
```

Документация по API находится в вики: https://github.com/B-Vladi/TSN/wiki/API.
<br />
Так же вы можете сгенерировать JSDoc документацию по API из исходников (файл <a href="https://github.com/B-Vladi/TSN/blob/master/TSN.js">TSN.js</a>).

###Контекст данных.
В JavaScript-выражениях, используемых в значениях атрибутов тегов TSN, переданные данные доступны в виде контекста через ключевое слово this.
<br />
Если TSN тег влияет на контекст, это затрагивает только его дочерних элементов.

###Теги
Управляющие конструкци TSN-шаблона представляют собой XML-теги с префиксом пространства имен `TSN`. Префикс может использоваться любой и настраивается в <a href="https://github.com/B-Vladi/TSN/blob/master/config.json">конфигурационном файле</a>, либо через <a href="https://github.com/B-Vladi/TSN/wiki/API#wiki-.config">API</a>.
TSN-парсер не учитывает XML-окружение, поэтому явно регистрировать префикс для постранства имен `TSN` не обязательно, но рекоммендуется для комфортной работы в IDE.

В значениях атрибутов тегов TSN могут использоваться следующие XML-сущности: `&amp; &lt; &gt; &quot; &apos;`.

Описание тегов с примерами использования в вики: https://github.com/B-Vladi/TSN/wiki/Tags
<hr />

###Пример Web-приложения
Файл page_name.xml:

```xml
<?xml version="1.0"?>
<tsn:root xmlns:tsn="TSN"
          xmlns="http://www.w3.org/1999/xhtml">

    <!-- Формирование контента для тега head -->
    <tsn:template name="head">
        <link type="text/css"
              rel="stylesheet"
              href="/page.css" />
    </tsn:template>

    <!-- Сохранение данных в области видимости этого шаблона -->
    <tsn:data name="GET"
              value="this.request.GET" />

    <!-- Формирование контента для тега body -->
    <tsn:template name="body">
        <!-- Вывод GET-параметра userName -->
        <h2>Hello, <tsn:echo data="_data.GET.userName"
                             escape="html" />!
        </h2>
    </tsn:template>

    <!-- Добавление контента перед закрывающим тегом body -->
    <tsn:template name="footer">
        <script type="text/javascript"
                src="page.js"></script>
    </tsn:template>

    <!-- Вставка базоваого шаблона разметки и формирование данных,
            которые будут для него контекстом -->
    <tsn:include src="/base.xml"
                 context="({
                     title: 'My name',
                     navigation: this.navigation,
                     request: {
                        status: 200
                     }
                 })" />
</tsn:root>
```
<br />
Файл base.xml:

```xml
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
    <tsn:root xmlns:tsn="TSN">
    <head>
        <!-- Формирование заголовка страницы -->
        <title>
            <tsn:echo data="this.title" /> - Hostname
        </title>

        <meta http-equiv="Content-Type"
              content="text/html; charset=utf-8" />

        <!-- Общие стили -->
        <link type="text/css"
              rel="stylesheet"
              href="/base.css" />

        <!-- Стили для конкретной страницы -->
        <tsn:include name="head" />
    </head>
    <body>
        <div class="wrapper">
            <!-- Шапка -->
            <tsn:include src="/header.xml"
                         context="this.navigation" />

            <!-- Если статус 200... -->
            <tsn:if test="this.request.status == 200">
                <!-- ...вставляем унаследованный контент страницы -->
                <tsn:include name="body" />
                <tsn:else />
                <!-- ...иначе вставляем страницу ошибки -->
                <tsn:include src="/error.xml" context="this.request.status" />
            </tsn:if>
        </div>

        <!-- Подключение скриптов для текущей страницы -->
        <tsn:include name="footer" />
    </body>
    </tsn:root>
</html>
```
<br />
JavaScript-код приложения:

```js
/* Подключение зависимостей */
var http = require('http');
var queryString = require('querystring');
var TSN = require('TSN');

/* Уберём комментарии из результата */
TSN.config.saveComments = false;

/* Компиляция шаблона */
TSN.load('page_name.xml', 'page_name', {
	indent: 4
});

/* Создание сервера */
http.Server(
	function (request, response) {
		/* Формирование данных для рендеринга */
		var data = {
			request: {
				GET: queryString.parse(request.url.substring(2))
			}
		};

		/* Рендеринг шаблона с записью результата в поток */
		TSN.cache['page_name'].call(data, response);
	}).listen(80, '127.0.0.1');
```
<br />
Запрос:

`http://127.0.0.1/?userName=Vasya`

<br />
<br />
Результат:
```html
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>My name - Hostname
    </title>

    <meta http-equiv="Content-Type"
          content="text/html; charset=utf-8" />

    <link type="text/css"
          rel="stylesheet"
          href="/base.css" />

<link type="text/css"
      rel="stylesheet"
      href="/page.css" />
</head>
<body>
    <div class="wrapper">

<h2>Hello, Vasya!
</h2>
    </div>

<script type="text/javascript"
        src="page.js"></script>
</body>
</html>
```



<hr />
По всем вопросам отвечу по почте: b-vladi@cs-console.ru.