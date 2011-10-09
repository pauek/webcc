#!/usr/bin/env node

var util = require('util');
var fs = require('fs');
var cc = require('c++-parser');
var ast = require('ast');

if (process.argv.length < 3) {
   console.log("usage: cc.js <input-file>");
   process.exit(1);
}

var ccfile = process.argv[2];

fs.readFile(ccfile, 'utf-8', function (err, data) {
   console.log(data);
   var tree = cc.parse(data);
   tree.walk(ast.showTree);
});

