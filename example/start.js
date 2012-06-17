/* Подключение зависимостей */
var http = require('http');
var queryString = require('querystring');
var path = require('path');
var TSN = require('TSN');

TSN.on('error', function (error) {
	console.log(error);
});

/* Определение базовой директории шаблонов */
TSN.config.templateRoot = path.join(__dirname, 'templates');

/* Удаление HTML-комментариев из шаблонов */
TSN.config.saveComments = false;

/* Компиляция всех шаблонов в корневой папке */
TSN.compileFromDir();

/* Создание сервера после компилирования всех шаблонов */
TSN.on('compileDirEnd', function () {
	http.Server(listener).listen(80, '127.0.0.1');
});

function listener(request, response) {
	/* Формирование данных для рендеринга */
	var data = {
		userName: queryString.parse(request.url.substring(2)).name
	};

	/* Рендеринг шаблона с записью результата в поток */
	TSN
		.cache[path.join(TSN.config.templateRoot, 'page.xml')]
		.call(data, response);

	response.end();
}