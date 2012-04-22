# TSN 2.0.2 #
https://github.com/B-Vladi/TSN/

Templating System for Node.JS.

## Лицензия
MIT: https://github.com/appendto/amplify/blob/master/MIT-LICENSE.txt

## Документация
###Конфигурация парсинга шаблонов.
В вики: https://github.com/B-Vladi/TSN/wiki/Configuration

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

###Примеры рендеринга шаблона.

С использованием API:

```js
var result = TSN.render(template, data);
```

Без использования:

```js
var result = template.call(data);
```

Более подробная информация по API находится в вики: https://github.com/B-Vladi/TSN/wiki/API.

###Описание тегов
В вики: https://github.com/B-Vladi/TSN/wiki/Tags