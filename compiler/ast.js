
var ast = ast || {};

/* Model of inheritance */

ast.__inherit__ = (function() {
   var F = function (typename) {
      this.typename = typename;
   };
   return function (typename, C, P) {
      F.prototype = P.prototype;
      C.prototype = new F(typename);
      C.uber = P.prototype;
      C.prototype.constructor = C;
   }
})();

/* Node type */

ast.Node = function () {};

ast.Node.prototype = {
   typename: "Node",
   __accept__: function (prefix, visitor) {
      var types = [this.typename, 'Node'];
      for (var i in types) {
         var method = prefix + types[i];
         if (method in visitor) {
            visitor[method].call(visitor, this);
            return;
         } 
      }
   },
   visit: function (visitor) {
      self.__accept__('visit', visitor);
   },
   walk: function (walker) {
      this.__accept__('enter', walker);
      for (var prop in this) {
         if (this.hasOwnProperty(prop) && 
             this[prop] instanceof ast.Node) {
            this[prop].walk(walker);
         }
      }
      this.__accept__('depart', walker);
   }
};

ast.NodeList = function() {
   this.children = [];
}

ast.__inherit__("NodeList", ast.NodeList, ast.Node);

ast.NodeList.prototype.add = function (obj) {
   this.children.push(obj);
}

/* Construct node types */

ast.makeNodeType = function (typename) {
   var NewType = function (obj) {
      for (var prop in obj) {
         if (obj.hasOwnProperty(prop)) {
	         this[prop] = obj[prop];
         }
      }
   }
   ast.__inherit__(typename, NewType, ast.Node);
   ast[typename] = NewType;
}

/* Create Types */

var nodeTypes = [
   "IncludeDirective", 
	"UsingDirective", 
   "InputStatement",
   "OutputStatement",
	"ForStmt", 
	"WhileStmt",
   "Block",
   "BinaryExpression",
];
for (var i in nodeTypes) { 
   ast.makeNodeType(nodeTypes[i]); 
}

/* Visitors */

ast.wShowTree = {
   indent: 0,
   log: function (msg) {
      var _indent = "";
      for (var i = 0; i < this.indent; i++) {
         _indent += " ";
      }
      console.log(_indent + msg);
   },
   enterNode: function(obj) {
      this.log("Node");
   },
   enterIncludeDirective: function (obj) {
      this.log("Include");
   },
   enterWhileStmt: function (obj) {
      this.log("WhileStmt:");
      this.indent += 3;
   },
   departWhileStmt: function (obj) {
      this.indent -= 3;
   }
}

ast.nodeCount = function () {
   this.count = 0;
}

ast.nodeCount.prototype = {
   vNode: function(obj) {
      this.count++;
   }
}

/* test... */

var util = require('util');

var i = new ast.IncludeDirective({ name: "iostream" });
var n = new ast.Node();
var w = new ast.WhileStmt({ cond: i, block: n });
console.log(util.inspect(w, true, 4))

w.walk(ast.wShowTree);

// var nc = new ast.nodeCount();
// i.visit(nc);
// console.log(nc.count);

/* Export */

module.exports.ast = ast;