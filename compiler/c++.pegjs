
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

DecimalDigit
  = [0-9]

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

Expression =
   StringLiteral /
   VariableReference

StringLiteral "string" = 
   '"' literal:StringCharacters? '"' {
      return new ast.StringLiteral({ lit: literal });
   }

StringCharacters = 
   chars:StringCharacter+ { 
      return chars.join(""); 
   }

StringCharacter = 
   !('"' / "\\" / LineTerminator) char_:SourceCharacter { return char_; } / 
   "\\" sequence:EscapeSequence { return sequence; } / 
   LineContinuation

EscapeSequence = 
   CharacterEscapeSequence / 
   "0" !DecimalDigit { return "\0"; }

CharacterEscapeSequence = 
  SingleEscapeCharacter / 
  NonEscapeCharacter

SingleEscapeCharacter = 
  char_:['"\\bfnrtv] {
      return char_
        .replace("b", "\b")
        .replace("f", "\f")
        .replace("n", "\n")
        .replace("r", "\r")
        .replace("t", "\t")
        .replace("v", "\x0B") // IE does not recognize "\v".
    }

NonEscapeCharacter = 
   (!EscapeCharacter / LineTerminator) char_:SourceCharacter { 
      return char_; 
   }

EscapeCharacter = 
   SingleEscapeCharacter / 
   DecimalDigit

LineContinuation
  = "\\" sequence:LineTerminatorSequence { return sequence; }

LineTerminatorSequence "end of line" = "\n" / "\r\n" / "\r"

Type =
  "int" /
  "char" /
  "float"

VariableReference =
   id:Identifier { return new ast.VariableReference({ var: id }); }

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
   t:Type __ lst:VariableDeclarationList __ ";" {
      return new ast.VariableDeclarationStatement({ type: t }, lst);
   }

OutputStatement =
   "cout" elems:(__ "<<" __ Expression)* ";" {
      var elements = [];
      for (var i in elems) {
         elements.push(elems[i][3]);
      }
      return new ast.OutputStatement({ head: "cout" }, elements);
   }

Statement =
   VariableDeclarationStatement /
   OutputStatement

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
   "{" __ body:FunctionBody? __ "}" {
      return new ast.FunctionDef({ name: n, params: p }, body);
   }

IncludeDirective "include" =
  "#include" _ [<"] file:[a-z]* [>"] {
     return new ast.IncludeDirective({ file: file });
  }

UsingDirective "using" =
  "using" __ "namespace" __ ns:Identifier __ ";" {
    return new ast.UsingDirective({ namespace: ns });
  }

ProgramPart =
  IncludeDirective /
  UsingDirective /
  FunctionDef /
  Comment

Program = 
   head:ProgramPart tail:(__ ProgramPart)* {
      var parts = [head];
      for (var i = 0; i < tail.length; i++) {
         parts.push(tail[i][1]);
      }  
      return new ast.Program({}, parts);
   }
