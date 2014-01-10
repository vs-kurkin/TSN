/* Подключение зависимостей */
var http = require('http');
var queryString = require('querystring');
var path = require('path');
var TEN = require('TEN');

var ten = new TEN();

/* Обработка ошибок */
ten.on('error', function (error, template) {
	console.log(error);
});

/* Создание сервера после компилирования всех шаблонов */
ten.on('compileDirEnd', function () {
	http.Server(listener).listen(80, '127.0.0.1');
});

ten.on('renderEnd', function (result, template) {
	console.log(result);
});

ten.options.debug = true;

/* Определение базовой директории шаблонов */
ten.options.pathRoot = path.join(__dirname, 'templates');

ten.options.API = {
	getData: function (value, callback) {
		process.nextTick(function () {
			callback(null, 'Data.');
		});
	}
};

/* Компиляция всех шаблонов в корневой папке. */
//TEN.compileFromFile('page.xml');
ten.compileFromDir(null, {
	saveComments: false
});

function listener(request, response) {
	/* Формирование данных для рендеринга */
	var data = {
		userName: queryString.parse(request.url.substring(2)).name
	};

	/* Рендеринг шаблона с записью результата в поток */
	response.setHeader('Content-type', 'text/html');
	console.log(ten.render('page.xml', data, response));

	/*
	* Приложение выводит значение GET-параметра name. Результат рендеринга находится в result.html.
	* */
}
