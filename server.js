
var express  = require('express');
var app = express.createServer();
app.use(express.static(__dirname));

app.listen(8080);
console.log("http://localhost:8080");

var dnode = require('dnode');
var spawn = require('child_process').spawn;

function split_lines(text) {
  var lines = [];
  var currline = '';
  for (var i = 0; i < text.length; i++) {
	 if (text[i] != '\n') {
		currline += text[i];
	 } else {
		currline = currline.replace(/<stdin>:/,'');
		lines.push(currline);
		currline = '';
	 }
  }
  return lines;
}

var compiler = "clang";

var server = dnode({
  compile: function (text, _callback) {
    var cc = spawn('/bin/sh', ['-c', compiler + ' -Wall -x c++ - -lstdc++']);
    var stderr = '';
    cc.stdin.end(text);
    cc.stderr.addListener('data', function (chunk) {
      stderr += chunk;
    });
    cc.addListener('exit', function (code, signal) {
		var lines = split_lines(stderr);
      _callback(lines);
    });
  }
});
server.listen(app);