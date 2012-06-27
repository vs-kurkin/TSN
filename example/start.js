/* Подключение зависимостей */
var http = require('http');
var queryString = require('querystring');
var path = require('path');
var TEN = require('TEN');

/* Обработка ошибок */
TEN.on('error', function (error) {
	console.log(error);
});

/* Создание сервера после компилирования всех шаблонов */
TEN.on('compileDirEnd', function () {
	http.Server(listener).listen(80, '127.0.0.1');
});

/* Определение базовой директории шаблонов */
TEN.config.templateRoot = path.join(__dirname, 'templates');

/* Компиляция всех шаблонов в корневой папке. */
TEN.compileFile('page.xml');
/*TEN.compileDir(null, {
	saveComments: false
});*/

function listener(request, response) {
	/* Формирование данных для рендеринга */
	var data = {
		userName: queryString.parse(request.url.substring(2)).name
	};

	/* Рендеринг шаблона с записью результата в поток */
	TEN.render('page.xml', data, response);

	response.end();

	/*
	* Приложение выводит значение GET-параметра name. Результат рендеринга находится в result.html.
	* */
}