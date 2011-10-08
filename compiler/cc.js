#!/usr/bin/env node

var util = require('util');
var fs = require('fs');
var cc = require('c++-parser');

fs.readFile('test.cc', 'utf-8', function (err, data) {
   var tree = cc.parse(data);
   console.log(util.inspect(tree, true, null));   
});

