# TSN 2.0.1 #
https://github.com/B-Vladi/TSN/tree/dev

Templating System for Node.JS.

## Лицензия
MIT: https://github.com/appendto/amplify/blob/master/MIT-LICENSE.txt

## Документация
### Конфигурация.

Стандартный конфиг описан в файле <a href="https://github.com/B-Vladi/TSN/blob/dev/config.json">config.json</a>.

В коде общие настройки для всех шаблонов указываются в

	TSN.config

####Параметры конфига:

* Параметры загрузки файлов шаблона:
  * `templateRoot`: Базовая дирректория файлов шаблонов. По-умолчанию ''.
  * `encoding`: Кодировка файлов. По-умолчанию 'utf-8'.
* Параметры парсинга шаблонов:
  * `namespace`: Пространство имен тегов TSN. По-умолчанию 'tsn'.
  * `parseCDATA`: Если значение парамерта false - содержимое секций CDATA будут распарсены. По-умолчанию false.
  * `saveComments`: Если значение парамерта false - HTML-комментарии будут удалены из результирующего кода шаблона. Условные комментарии Internet Explorer не будут удалены в любом случае.  По-умолчанию true.
* Параметры отступов, используемых в коде шаблона.
  * `indent`: Размер отступа в пробелах. По-умолчанию 2.
  * `tabSize`: Размер одного символа табуляции в пробелах. По-умолчанию 2.


API обработки шаблонов находятся в пространстве имен TSN, которое является экземпляром конструктора <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.
###Инициализация модуля
	var TSN = require('TSN');

	TSN.once('ready', function () {
		console.log(this === TSN); // true
		// Модуль инициализирован и готов к использованию.
	});

###Компиляция шаблона.
Компиляция из файла:

	TSN.load('path/to/template.xml'); // Компиляция относительно TSN.config.templateRoot.

Компиляция шаблона с использованием собственных настроек. Неуказанные параметры будут унаследованы из TSN.config.

	TSN.load('path/to/template.xml', null, {
		templateRoot: 'path/to/new/template/root'
	});

Использование callback-функции при парсинге конкретного шаблона:

	TSN.load('path/to/template.xml', null, null, function (template) {
		console.log(template.name === TSN.config.templateRoot + 'path/to/template.xml'); // true
	});

Использование имени шаблона:

	TSN.load('path/to/template.xml', 'My name', null, function (template) {
		console.log(template.name === 'My name'); // true
		console.log(this.cache['My name'] === template); // true
	});

Использование события compiled:

	TSN
		.once('compiled', function (template) {
			console.log(template); // [Function]
		})
		.load('path/to/template.xml');

Компиляция шаблона из данных:

	TSN.compile('<tsn:root xmlns:tsn="TSN">Text data</tsn:root>');

Остальные аргументы аналогичны TSN.load;

###Рендеринг шаблона.

С использованием API:

	var result = TSN.render(template, data);

Без использования:

	var result = template.call(data);

###Теги.

####root
Вспомогательный элемент для использования в XML-файлах в качестве корневого.

Атрибуты:
<table>
	<thead>
		<tr>
			<td><b>Имя</b></td>
			<td><b>Значение по-умолчанию</b></td>
			<td><b>Варианты значений</b></td>
			<td><b>Обязательный</b></td>
			<td><b>Описание</b></td>
		</tr>
	</thead>

	<tbody>
		<tr>
			<td>xmlns:tsn</td>
			<td>TSN</td>
			<td></td>
			<td>нет</td>
			<td>Объявляет пространство имен TSN для поддержки автодополнения в IDE.</td>
		</tr>
		<tr>
			<td>context</td>
			<td>this</td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Устанавливает контекст для дочерних элементов</td>
		</tr>
	</tbody>
</table>