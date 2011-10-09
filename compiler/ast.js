
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
   isGroup: function () {
      return this.hasOwnProperty('__children__');
   },
   forEachChild: function (fn) {
      for (var i in this.__children__) {
         fn(this.__children__[i]);
      }
   },
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
      this.__accept__('visit', visitor);
   },
   walk: function (walker) {
      this.__accept__('enter', walker);
      this.forEachChild(function (obj) {
         obj.walk(walker);
      });
      this.__accept__('depart', walker);
   }
};

/* Construct node types */

ast.makeNodeType = function (typename) {
   var NewType = function (obj, children) {
      for (var prop in obj) {
         if (obj.hasOwnProperty(prop)) {
	         this[prop] = obj[prop];
         }
      }
      if (children) {
         this.__children__ = children;
      }
   }
   ast.__inherit__(typename, NewType, ast.Node);
   ast[typename] = NewType;
}

/* Create Types */

var nodeTypes = [
   "IncludeDirective", 
	"UsingDirective", 
   "Identifier",
   "FunctionDef", 
   "Program", 
   "VariableReference",
   "VariableDeclaration",
   "VariableDeclarationStatement",
   "InputStatement",
   "OutputStatement",
	"ForStmt", 
	"WhileStmt",
   "Block",
   "BinaryExpression",
   "StringLiteral",
];
for (var i in nodeTypes) { 
   ast.makeNodeType(nodeTypes[i]); 
}

/* Visitors */

// showTree

ast.showTree = {
   indent: 0,
   group: false,

   log: function (msg) {
      var _indent = "";
      for (var i = 0; i < this.indent; i++) {
         _indent += " ";
      }
      console.log(_indent + msg);
   },
   enterNode: function(obj) {
      this.log(obj.typename);
      if (obj.isGroup()) this.indent += 3;
   },
   departNode: function (obj) {
      if (obj.isGroup()) this.indent -= 3;
   }
}

// nodeCount

ast.nodeCount = function () {
   this.count = 0;
}

ast.nodeCount.prototype = {
   visitNode: function(obj) {
      this.count++;
   }
}

// rewriter

ast.rewriter = function () {
   this.indent = 0;
   this.output = "";
}

ast.rewriter.prototype = {
   emit: function (str) {
      this.output += str;
   },
   visitIncludeDirective: function (obj) {
      this.emit("#include <" + obj.file + ">\n");
   },
   visitUsingDirective: function (obj) {
      this.emit("using namespace " + obj.namespace + ";\n");
   },
}

/* test... */

ast.test = function () {
   var util = require('util');
   
   var i = new ast.IncludeDirective({ name: "iostream" });
   var n = new ast.Node();
   var w = new ast.WhileStmt({ cond: i, block: n });
   console.log(util.inspect(w, true, 4))
   
   w.walk(ast.showTree);
   
   var nc = new ast.nodeCount();
   i.visit(nc);
   console.log(nc.count);
}

/* Export */

// ast.test();

module.exports = ast;