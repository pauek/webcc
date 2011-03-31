
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

var compiler = "gcc";

var server = dnode(function (client, connection) {
  this.startSession = function (_callback) {
	 // Aquí se puede mirar un login+password
	 _callback(new Session({
		client: client,
		connection: connection,
	 }));
  }
});

var global_id = 1;

var Session = function (params) {
  var conn = params.connection;
  var client = params.client;
  var id = global_id;
  global_id += 1;

  console.log("Session start: " + id + ' ' + client + ' ' + conn);
  
  conn.addListener('end', function() {
	 console.log('Session end:' + id + ' ' + client + ' ' + conn);
  });

  this.compile = function (text, _callback) {
	 var cmd = compiler + ' -o a.out.' + id + ' -Wall -x c++ - -lstdc++';
    var cc = spawn('/bin/sh', ['-c', cmd]);
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

  this.run = function (text, _callback) {
	 var cmd = './a.out.' + id;
	 var exe = spawn('/bin/sh', ['-c', cmd]);
	 var stdout = '';
	 exe.stdin.end(text);
	 exe.stdout.addListener('data', function (chunk) {
		stdout += chunk;
	 });
	 exe.addListener('exit', function (code, signal) {
		var outputLines = stdout.split('\n');
		_callback(outputLines);
	 });
  }
}

server.listen(app);