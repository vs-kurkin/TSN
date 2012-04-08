# TSN 2.0.1 #
https://github.com/B-Vladi/TSN/tree/dev

Templating System for Node.JS.

## Лицензия
MIT: https://github.com/appendto/amplify/blob/master/MIT-LICENSE.txt

## Документация
### Конфигурация.

Стандартный конфиг описан в файле <a href="https://github.com/B-Vladi/TSN/blob/dev/config.json">config.json</a>.

В коде общие настройки для всех шаблонов указываются в `TSN.config`.

####Параметры конфига:

* Параметры загрузки файлов шаблона:
  * `templateRoot`: Базовая дирректория файлов шаблонов. По-умолчанию ''.
  * `encoding`: Кодировка файлов. По-умолчанию 'utf-8'.
* Параметры парсинга шаблонов:
  * `namespace`: Пространство имен тегов TSN. По-умолчанию 'tsn'.
  * `parseCDATA`: Если значение парамерта true - содержимое секций CDATA будут распарсены. По-умолчанию false.
  * `saveComments`: Если значение парамерта false - HTML-комментарии будут удалены из результирующего кода шаблона. <a href="http://msdn.microsoft.com/en-us/library/ms537512(v=vs.85).aspx">Условные комментарии</a> Internet Explorer не будут удалены в любом случае.  По-умолчанию true.
* Параметры отступов, используемых в коде шаблона.
  * `indent`: Размер отступа в пробелах. По-умолчанию 2.
  * `tabSize`: Размер одного символа табуляции в пробелах. По-умолчанию 2.


API обработки шаблонов находятся в пространстве имен TSN, которое является экземпляром конструктора <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">events.EventEmitter</a>.

###Компиляция шаблона.
Компиляция из файла:

	TSN.load('path/to/template.xml'); // Компиляция относительно TSN.config.templateRoot.

Компиляция шаблона с использованием собственных настроек. Параметры, которые не были указаны в этом объекте, будут унаследованы от `TSN.config`.

	TSN.load('path/to/template.xml', null, {
		templateRoot: 'path/to/new/template/root'
	});

Использование callback-функции:

	TSN.load('path/to/template.xml', null, null, function (template) {
		console.log(template.name === require('path').join(TSN.config.templateRoot, 'path/to/template.xml')); // true
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

Остальные аргументы аналогичны TSN.load.

###Рендеринг шаблона.

С использованием API:

	var result = TSN.render(template, data);

Без использования:

	var result = template.call(data);

###Теги.

####Comment
Комментарий. Содержимое тега будет удалено из результирующего кода шаблона.

<b>Атрибуты:</b> нет.

####Echo
Выводит текстовые данные в результат рендеринга. Одиночный тег.

<b>Атрибуты:</b>
<table>
	<thead>
		<tr>
			<th>Имя</th>
			<th>Значение по-умолчанию</th>
			<th>Варианты значений</th>
			<th>Обязательный</th>
			<th>Описание</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>text</td>
			<td>this</td>
			<td>JavaScript выражение</td>
			<td>нет</td>
			<td>Выражение, результат которого будет вставлен на место тега.</td>
		</tr>
		<tr>
			<td>type</td>
			<td></td>
			<td><b>json</b>: значение выражения text будет преобразовано в строку функцией JSON.stringify.</td>
			<td>нет</td>
			<td>Тип выводимых данных.
			</td>
		</tr>
		<tr>
			<td>escape</td>
			<td></td>
			<td>
				<b>js</b>: подготавливает данные, предназначенные для вставки в JavaScript-строку.<br />
				<b>decAll</b>: заменяет все символы, кроме a-z 0-9 - _ . на десятиричные HTML-коды.<br />
				<b>decHtml</b>: заменяет символы &amp;&lt;&gt;&quot;' на десятиричные HTML-коды.<br />
				<b>hexAll</b>: заменяет все символы, кроме a-z 0-9 - _ . на шестнадцатеричные HTML-коды.<br />
				<b>hexHtml</b>: заменяет символы &amp;&lt;&gt;&quot;' на шестнадцатеричные HTML-коды.<br />
				<b>hexUrl</b>: кодирует URL-строку функцией encodeURI.<br />
				<b>hexUrlAll</b>: кодирует URL-строку функцией encodeURIComponent.<br />
			</td>
			<td>нет</td>
			<td>Метод экранирования, которое будет применено к результату выражения text после преобразования type, если последнее было указано.
			</td>
		</tr>
	</tbody>
</table>

<b>Пример:</b>

Код шаблона:

	<?xml version="1.0" encoding="UTF-8"?>
	<tsn:root xmlns:tsn="TSN">
		<div>
			<tsn:echo text="this.string" />
		</div>
		<div>
			<tsn:echo text="this.string" escape="decAll" />
		</div>
		<div>
			<tsn:echo type="json" />
		</div>
		<script>
			var data = '<tsn:echo text="this.string" escape="js"/>';
		</script>
	</tsn:root>

Вызов:

	template.call({
		string: '\'Stiff Opposition Expected to \nCasketless Funeral Plan\'',
		array: [1, 2, 3]
	});

Результат:

		<div>'Stiff Opposition Expected to
		Casketless Funeral Plan'
		</div>
		<div>&#39;Stiff&#32;Opposition&#32;Expected&#32;to&#32;&#10;Casketless&#32;Funeral&#32;Plan&#39;
		</div>
		<div>{"string":"'Stiff Opposition Expected to \nCasketless Funeral Plan'","array":[1,2,3]}
		</div>
		<script>
			var data = '\'Stiff Opposition Expected to \
		Casketless Funeral Plan\'';
		</script>

####Root
Вспомогательный тег для использования в XML-файлах в качестве корневого.

<b>Атрибуты:</b>
<table>
	<thead>
		<tr>
			<th>Имя</th>
			<th>Значение по-умолчанию</th>
			<th>Варианты значений</th>
			<th>Обязательный</th>
			<th>Описание</th>
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
			<td>Устанавливает контекст для дочерних элементов.</td>
		</tr>
	</tbody>
</table>

<b>Пример:</b>

Код шаблона:

	<?xml version="1.0" encoding="UTF-8"?>
	<!DOCTYPE tsn:root PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
	<tsn:root xmlns:tsn="TSN" context="this.contextRoot">
		<div>
			<span><tsn:echo text="this.first" /></span>
		</div>
		<div>
			<span><tsn:echo text="this.second" /></span>
		</div>
	</tsn:root>

Вызов:

	template.call({
	 contextRoot: {
		 first: 'First data',
		 second: 'Second data'
	 }
	});

Результат:

	<div>
		<span>First data</span>
	</div>
	<div>
		<span>Second data</span>
	</div>

####Context
Устанавливает контекст для дочерних элементов.

<b>Атрибуты:</b>
<table>
	<thead>
		<tr>
			<th>Имя</th>
			<th>Значение по-умолчанию</th>
			<th>Варианты значений</th>
			<th>Обязательный</th>
			<th>Описание</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>object</td>
			<td>this</td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Результат выражения будет контекстом для дочерних элементов. Если этот атрибут присутствует, будет создана локальная область видимости.</td>
		</tr>
	</tbody>
</table>

<b>Пример:</b>

Код шаблона:

	<?xml version="1.0" encoding="UTF-8"?>
	<tsn:context object="this.context">
		<div><tsn:echo text="this" /></div>
	</tsn:context>

Вызов:

	template.call({
		 context: 'Context data'
	});

Результат:

	<div>Context data</div>

####Var
Создает переменную в текущей области видимости.

<b>Атрибуты:</b>
<table>
	<thead>
		<tr>
			<th>Имя</th>
			<th>Значение по-умолчанию</th>
			<th>Варианты значений</th>
			<th>Обязательный</th>
			<th>Описание</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>name</td>
			<td></td>
			<td>Корректное JavaScript имя переменной.</td>
			<td>да</td>
			<td>Имя переменной.</td>
		</tr>
		<tr>
			<td>value</td>
			<td></td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Значение переменной. Если атрибут не указан, значением переменной будет вычисленное содержимое тега. В последнем случае создается локальная область видимости.</td>
		</tr>
		<tr>
			<td>context</td>
			<td>true</td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Устанавливает контекст для дочерних элементов, если не был указан атрибут value.</td>
		</tr>
	</tbody>
</table>

<b>Пример:</b>

Код шаблона:

	<?xml version="1.0" encoding="UTF-8"?>
	<tsn:root>
		<tsn:var name="firstData" value="this.firstData" />
		<tsn:var name="secondData">
			<div>
				<tsn:echo text="this.secondData" />
			</div>
		</tsn:var>

		<div>
			<tsn:echo text="firstData" />
		</div>
		<tsn:echo text="secondData" />
	</tsn:root>

Вызов:

	template.call({
		firstData: 'First data',
		secondData: 'Second data'
	});

Результат:

	<div>First data
	</div>
	<div>Second data
	</div>

####Entity
Создает TSN-сущность.
Для вывода значения сущности используется синтаксис:

	&namespace.name;

, где <i>namespase</i> - пространство имен тегов TSN, <i>name</i> - имя сущности. TSN-сущность не может использоваться в значениях атрибутов тегов TSN. В отличии от переменных, сущности доступны в любом месте, независимо от области видимости, в которой они определены.

<b>Атрибуты:</b>
<table>
	<thead>
		<tr>
			<th>Имя</th>
			<th>Значение по-умолчанию</th>
			<th>Варианты значений</th>
			<th>Обязательный</th>
			<th>Описание</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>name</td>
			<td></td>
			<td>Строка, состоящая из символов: a-z - _</td>
			<td>да</td>
			<td>Имя сущности.</td>
		</tr>
		<tr>
			<td>value</td>
			<td></td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Значение сущности. Если атрибут не указан, значением переменной будет вычисленное содержимое тега. В последнем случае создается локальная область видимости.</td>
		</tr>
		<tr>
			<td>context</td>
			<td>true</td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Устанавливает контекст для дочерних элементов, если не был указан атрибут value.</td>
		</tr>
	</tbody>
</table>

<b>Пример:</b>

Код шаблона:

	<?xml version="1.0" encoding="UTF-8"?>
	<tsn:root>
		<tsn:entity name="className" value="this.className" />
		<div class="&TSN.className;">Text data</div>
	</tsn:root>

Вызов:

	template.call({
		className: 'active'
	});

Результат:

	<div class="active">Text data</div>