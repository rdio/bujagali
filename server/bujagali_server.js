/* Bujagali server for node.js
 *
 * Takes Bujagali data and renders it.
 */

/*jslint evil:true */
/*globals require module console */

var http = require('http'),
    sys = require('sys');

module.exports = http.createServer(function(request, response) {
    var input = '';
    request.setEncoding('utf8');
    request.on('data', function(data) {
        input = input + data;
    });
    request.on('end', function() {
        try {
            eval(input);
        }
        catch (e) {
            console.timeEnd('bg_render_time');
            var body = 'Error occurred while evaluating template: ' +
                e.stack;
            response.writeHead(500, {
                'Content-Length': body.length,
                'Content-Type': 'text/plain'
            });
            response.end(body, 'utf8');
        }
    });
});
