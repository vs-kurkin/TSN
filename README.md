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

Остальные аргументы аналогичны TSN.load.

###Рендеринг шаблона.

С использованием API:

```js
var result = TSN.render(template, data);
```

Без использования:

```js
var result = template.call(data);
```

Более подробная информация по API находится здесь: https://github.com/B-Vladi/TSN/blob/dev/jsdoc/TSN.html.

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
			<td>Тип выводимых данных.</td>
		</tr>
		<tr>
			<td>escape</td>
			<td></td>
			<td>
				<b>js</b>: подготавливает данные, предназначенные для вставки в JavaScript-строку.<br />
				<b>html</b>: заменяет символы &amp;&lt;&gt;&quot; на HTML-сущности.<br />
				<b>htmlDec</b>: заменяет символы &amp;&lt;&gt;&quot; на десятиричные HTML-коды.<br />
				<b>htmlHex</b>: заменяет символы &amp;&lt;&gt;&quot; на шестнадцатеричные HTML-коды.<br />
				<b>url</b>: кодирует URL-строку функцией encodeURI.<br />
			</td>
			<td>нет</td>
			<td>Метод экранирования, которое будет применено к результату выражения text после преобразования type, если последнее было указано.
			</td>
		</tr>
	</tbody>
</table>

Так же для вывода данных (включая атрибуты) можно использовать TSN-сущность:

	&namespace.property;

Здесь:

`namespase`: текущее пространство имен тегов TSN

`property`: JavaScript-выражение, представляющее собой доступ к значению свойства объекта с использованием точечной нотации. Допускаются символы `A-Za-z0-9._-`.

TSN-сущности не могут использоваться в значениях атрибутов тегов TSN.

<b>Пример:</b>

Код шаблона:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:root xmlns:tsn="TSN">
	<div>
		&TSN.this.string;
	</div>
	<div>
		<tsn:echo text="this.string" escape="htmlDec" />
	</div>
	<div>
		<tsn:echo type="json" />
	</div>
	<script>
		var data = "<tsn:echo text="this.string" escape="js"/>";
	</script>
</tsn:root>
```

Вызов:

```js
template.call({
	string: '"Stiff Opposition Expected to \nCasketless Funeral Plan"',
	array: [1, 2, 3]
});
```

Результат:

```html
<div>'Stiff Opposition Expected to
Casketless Funeral Plan'
</div>
<div>&qout;Stiff Opposition Expected to
Casketless Funeral Plan&qout;
</div>
<div>{"string":"\"Stiff Opposition Expected to \nCasketless Funeral Plan\"","array":[1,2,3]}
</div>
<script>
	var data = "\"Stiff Opposition Expected to \
Casketless Funeral Plan\"";
</script>
```

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

```xml
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
```

Вызов:

```js
template.call({
 contextRoot: {
	 first: 'First data',
	 second: 'Second data'
 }
});
```

Результат:

```html
<div>
	<span>First data</span>
</div>
<div>
	<span>Second data</span>
</div>
```

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

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:context object="this.context">
	<div><tsn:echo text="this" /></div>
</tsn:context>
```

Вызов:

```js
template.call({
	 context: 'Context data'
});
```

Результат:

```html
<div>Context data</div>
```

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

```xml
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
	&TSN.secondData;
</tsn:root>
```

Вызов:

```js
template.call({
firstData: 'First data',
secondData: 'Second data'
});
```

Результат:

```html
<div>First data
</div>
<div>Second data
</div>
```

####If
Выполняет содержимое, если выражение test возвращает true.

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
			<td>test</td>
			<td>this</td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Выражение, результат которого влияет на обработку содержимого тега.</td>
		</tr>
	</tbody>
</table>

<b>Пример:</b>

Код шаблона:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:if>
	Context is defined.
</tsn:if>
```

Вызов:

```js
template.call(1);
```

Результат:

	Context is defined.

####Unless
Выполняет содержимое, если выражение test возвращает false.

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
			<td>test</td>
			<td>this</td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Выражение, результат которого влияет на обработку содержимого тега.</td>
		</tr>
	</tbody>
</table>

<b>Пример:</b>

Код шаблона:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:unless>
	Context is not defined.
</tsn:unless>
```

Вызов:

```js
template.call();
```

Результат:

	Context is not defined.

####For
Перебирает переданный массив. Создается локальная область видимости для дочерних элементов. В локальной области видимости создаются дополнительные переменные:

* `_array`: результат выражения array.
* `_length`: длина массива.
* `_index`: индекс текущего элемента массива.

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
			<td>array</td>
			<td>this</td>
			<td>JavaScript выражение.</td>
			<td>нет</td>
			<td>Выражение, результатом которого должен быть массив.</td>
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

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:for>
	<tsn:echo text="this[_index]" />
</tsn:for>
```

Вызов:

```js
template.call(['a', 'b', 'c']);
```

Результат:

	abc

####Each
Перебирает собственные свойства переданного объекта. Создается локальная область видимости для дочерних элементов. В локальной области видимости создаются дополнительные переменные:

* `_object`: результат выражения object.
* `_property`: имя текушего свойства.

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
			<td>Выражение, результатом которого должен быть объект.</td>
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

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:each>
	<tsn:echo text="_object[_property]" />
</tsn:each>
```

Вызов:

```js
template.call({
	a: '1',
	b: '2',
	c: '3'
});
```

Результат:

	123

####Template
Регистрирует inline-шаблон.

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
			<td></td>
			<td>да</td>
			<td>Имя шаблона.</td>
		</tr>
	</tbody>
</table>

####Include
Вставляет код шаблона на своё место. Создает локальную область видимости. Одиночный тег.

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
			<td></td>
			<td>нет</td>
			<td>Имя inline-шаблона.</td>
		</tr>
		<tr>
			<td>src</td>
			<td></td>
			<td>Путь.</td>
			<td>нет</td>
			<td>Путь к файлу шаблона относительно текущего шаблона или TSN.config.templateRoot. Подключаемый шаблон наследует inline-шаблоны и перемнные из родительских шаблонов.</td>
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

Обязательно должен присутствовать тег name или src.

<b>Пример:</b>

Код шаблона:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:root xmlns:tsn="TSN">
	<tsn:template name="tmpl">
		<tsn:echo />
	</tsn:template>
	<div>
		<tsn:include src="template.xml" />
	</div>
	<div>
		<tsn:include name="tmpl" />
	</div>
</tsn:root>
```

Код файла template.xml:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tsn:root xmlns:tsn="TSN">
	<tsn:include name="tmpl" />
	<tsn:template name="tmpl">
		Included data.
	</tsn:template>
	<tsn:include name="tmpl" />
</tsn:root>
```

Вызов:

```js
template.call('Parent data.');
```

Результат:

```html
<div>Parent data.
Included data.
</div>
<div>Parent data.
</div>
```