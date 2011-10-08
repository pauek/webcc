
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
   forEachProperty: function (fn_node, fn_not_node) {
      for (var prop in this) {
         var own = this.hasOwnProperty(prop);
         var is_node = this[prop] instanceof ast.Node;
         var is_array_of_nodes = false;
         if (this[prop] instanceof Array) {
            is_array_of_nodes = true;
            for (var i in this[prop]) {
               if (!(this[prop][i] instanceof ast.Node)) {
                  is_array_of_nodes = false;
               }
            }
         }
         if (own && (is_node || is_array_of_nodes)) {
            if (fn_node !== null) fn_node(this[prop]);
         } else {
            if (fn_not_node !== null) fn_not_node(this[prop]);
         }
      }
   }, 
   forEachSubNode: function (fn) {
      this.forEachProperty(fn, null);
   },
   forEachNonNode: function (fn) {
      this.forEachProperty(null, fn);
   },
   isGroup: function () {
      var c = 0;
      this.forEachSubNode(function () { c++; });
      return c > 0;
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
      this.forEachSubNode(function (prop) {
         if (prop instanceof Array) {
            for (var i in prop) { prop[i].walk(walker); }
         } else {
            prop.walk(walker);
         }
      });
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
   "Identifier",
   "FunctionDef", 
   "Program", 
   "VariableDeclaration",
   "VariableDeclarationStatement",
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

ast.nodeCount = function () {
   this.count = 0;
}

ast.nodeCount.prototype = {
   visitNode: function(obj) {
      this.count++;
   }
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