
start = 
   __ program:Program __ { return program; }

WhiteSpace = [ \t\f]
LineTerminator = [\n\r]
LineTerminatorSeq = "\n" / "\r\n" / "\r"
SourceCharacter = .

__ =
   (WhiteSpace / LineTerminatorSeq / Comment)*

_ =
   (WhiteSpace / MultiLineCommentOneLine / SingleLineComment)*

Literal = [0-9]

MultiLineComment =
   "/*" (!"*/" SourceCharacter)* "*/"

MultiLineCommentOneLine = 
   "/*" (!("*/" / LineTerminator) SourceCharacter)* "*/"

SingleLineComment =
   "//" (!LineTerminator SourceCharacter)*

Comment =
   MultiLineComment /
   SingleLineComment

Identifier = 
   name:([_A-Za-z] [_A-Za-z0-9]*) {
      return new ast.Identifier(name);
   }

Type =
  "int" /
  "char" /
  "float"

FormalParameter =
   type:Type _ name:Identifier {
      return {
         type: type,
         name: name
      }
   }

FormalParameterList =
   head:FormalParameter tail:(__ "," __ FormalParameter)* {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
         result.push(tail[i][3]);
      }
      return result;
   }

VarDecl =
   name:Identifier (__ "=" __ value:Literal)? {
      return {
         name: name,
         value: value,
      }
   }

VarDeclList =
   head:VarDecl tail:(__ "," __ VarDecl) {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
         result.push(tail[i][3]);
      }
      return result;
   }

VarDeclStmt =
   type:Type __ list:VarDeclList {
      return new ast.VarDeclStmt(type, list);
   }

Stmt =
   VarDeclStmt

StmtList =
   head:Stmt tail:(__ Stmt)* {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
         result.push(tail[i][1]);
      }
      return result;
   }


FunctionBody =
   StmtList

FunctionDef =
   Type _ name:Identifier 
   "(" __ params:FormalParameterList? __ ")" __
   "{" __ elements:FunctionBody? __ "}" {
      return new ast.Function(name, params, elements);
   }

IncludeDirective "include" =
  "#include" _ [<"] file:[a-z]* [>"] {
     console.log("include!");
     return new ast.Include(file)
  }

ProgramPart =
  IncludeDirective /
  FunctionDef /
  Comment

Program = 
   head:ProgramPart tail:(__ ProgramPart)* {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
         result.push(tail[i][1]);
      }  
      return new ast.Program(result);
   }


