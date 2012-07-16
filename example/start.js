/* Подключение зависимостей */
var http = require('http');
var queryString = require('querystring');
var path = require('path');
var TEN = require('TEN');

/* Обработка ошибок */
TEN.on('error', function (error, template) {
	console.log(error);
});

/* Создание сервера после компилирования всех шаблонов */
TEN.on('compileDirEnd', function () {
	http.Server(listener).listen(80, '127.0.0.1');
});

TEN.on('renderEnd', function (result, template) {
	console.log(result);
});

TEN.config.debug = true;

/* Определение базовой директории шаблонов */
TEN.config.templateRoot = path.join(__dirname, 'templates');

TEN.config.API = {
	getData: function (value, callback) {
		process.nextTick(function () {
			callback(null, 'Data.');
		});
	}
};

/* Компиляция всех шаблонов в корневой папке. */
//TEN.compileFile('page.xml');
TEN.compileDir(null, {
	saveComments: false
});

function listener(request, response) {
	/* Формирование данных для рендеринга */
	var data = {
		userName: queryString.parse(request.url.substring(2)).name
	};

	/* Рендеринг шаблона с записью результата в поток */
	response.setHeader('Content-type', 'text/html');
	console.log(TEN.render('page.xml', data, response));

	/*
	* Приложение выводит значение GET-параметра name. Результат рендеринга находится в result.html.
	* */
}