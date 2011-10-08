
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
      return new ast.Identifier({ id: name });
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

VariableDeclaration =
   name:Identifier (__ "=" __ value:Literal)? {
      var result = { name: name };
      if (typeof value != 'undefined') {
         result.value = value;
      }
      return new ast.VariableDeclaration(result);
   }

VariableDeclarationList =
   head:VariableDeclaration tail:(__ "," __ VariableDeclaration)* {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
         result.push(tail[i][3]);
      }
      return result;
   }

VariableDeclarationStatement =
   t:Type __ v:VariableDeclarationList __ ";" {
      return new ast.VariableDeclarationStatement({ type: t, list: v });
   }

Statement =
   VariableDeclarationStatement

StatementList =
   head:Statement tail:(__ Statement)* {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
         result.push(tail[i][1]);
      }
      return result;
   }


FunctionBody =
   StatementList

FunctionDef =
   Type _ n:Identifier 
   "(" __ p:FormalParameterList? __ ")" __
   "{" __ e:FunctionBody? __ "}" {
      return new ast.FunctionDef({ name: n, params: p, body: e });
   }

IncludeDirective "include" =
  "#include" _ [<"] file:[a-z]* [>"] {
     return new ast.IncludeDirective({ file: file });
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
      return new ast.Program({ parts: result });
   }


