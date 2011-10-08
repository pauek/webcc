
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
};

ast.NodeList = function() {
   this.children = [];
}

ast.__inherit__("NodeList", ast.NodeList, ast.Node);

ast.NodeList.prototype.add = function (obj) {
   this.children.push(obj);
}


/* Construct node types */

function nodeTypeMaker(Base) {
   return function (typename) {
      var NewType = function (obj) {
         for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
	            this[prop] = obj[prop];
            }
         }
      }
      ast.__inherit__(typename, NewType, Base);
      ast[typename] = NewType;
   }
}

ast.makeNodeType = nodeTypeMaker(ast.Node);

/* Create Node Types */


var types = [
   "IncludeDirective", 
	"UsingDirective", 
	"ForStmt", 
	"WhileStmt",
];
for (var i in types) {
   ast.makeNodeType(types[i]);
}

/* Visitors */

ast.reportVisitor = {
   vNode: function(obj) {
      console.log("seen a Node!");
   },
   vIncludeDirective: function (obj) {
      console.log("seen an Include!");
   },
   vNodeList: function (obj) {
      console.log("seen a NodeList!");
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
var L = new ast.NodeList();
L.add(i);
L.add(n);
console.log(util.inspect(L, true, 4))

L.accept(ast.reportVisitor);

var nc = new ast.nodeCount();
i.accept(nc);
console.log(nc.count);
