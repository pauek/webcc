
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
   accept: function (visitor) {
      var methodName = 'v' + this.typename;
      if (methodName in visitor) {
         visitor[methodName].call(visitor, this);
      } else if ('vNode' in visitor) {
         visitor['vNode'].call(visitor, this);
      }
   },
   walk: function (walker) {
      this.accept(walker);
      for (var prop in this) {
         if (this.hasOwnProperty(prop) && 
             this[prop] instanceof ast.Node) {
            this[prop].walk(walker);
         }
      }
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

ast.reportVisitor = {
   vNode: function(obj) {
      console.log("seen a Node!");
   },
   vIncludeDirective: function (obj) {
      console.log("seen an Include!");
   },
   vWhileStmt: function (obj) {
      console.log("seen a WhileStmt!");
      for (var i in obj.children) {
         obj.children[i].accept(this);
      }
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
var L = new ast.WhileStmt({ cond: i, block: n });
console.log(util.inspect(L, true, 4))

L.walk(ast.reportVisitor);

var nc = new ast.nodeCount();
i.accept(nc);
console.log(nc.count);

/* Export */

module.exports.ast = ast;