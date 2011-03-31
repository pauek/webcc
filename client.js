
var editor;

function clear_errors() {
  $("#errors").html('');
}

var highlighted_item = null;

function highlight_item(item) {
  if (highlighted_item) {
	 $(highlighted_item).css({ background: "none" });
  }
  $(item).css({ background: "red", });
  highlighted_item = item;
}

function error_line(err) {
  var patt = /^(\d+): ?error:/;
  var M = err.match(patt);
  var lineno;
  if (M && M.length > 0) {
	 lineno = Number(M[0]);
  }
  return lineno;
}

function add_error(err) {
  $('<pre>' + err + '</pre>')
    .click(function () {
		var ln = error_line(err);
		if (ln) {
		  editor.scrollToLine(ln, false);
		}
		highlight_item(this);
	 })
	 .appendTo("#errors");
}

function show_errors(errs) {
  clear_errors();
  if (errs.length == 0) {
	 $("#errors").css({ height: 0 });
  } else {
	 $("#errors").css({ height: "30%" });
	 for (var i = 0; i < errs.length; i++) {
		add_error(errs[i]);
	 }
  }
  var H = $("#errors").height();
  $("#editor").css({ bottom: H });
  editor.resize();
}

function setup(remote) {
  editor = ace.edit("editor");
  var CppMode = require("ace/mode/c_cpp").Mode;
  editor.getSession().setMode(new CppMode());

  $("#compile").click(function () {
    var code = editor.getSession().getDocument().getValue();
    remote.compile(code, show_errors);
  });

  $("#errors").resize(function () {
	 var y = $("body").height() - $("#errors").height();
    alert(y);
	 $("#editor").css({ bottom: y });
  });
}

$(document).ready(function () {
  DNode.connect(setup);
});
