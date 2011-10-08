#!/usr/bin/env node

var util = require('util');
var fs = require('fs');
var cc = require('c++-parser');
var ast = require('ast');

fs.readFile('test.cc', 'utf-8', function (err, data) {
   var tree = cc.parse(data);
   tree.walk(ast.showTree);
});

