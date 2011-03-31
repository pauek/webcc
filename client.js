
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
  var M = err.match(/^(\d+):(\d+)?:?/);
  var lineno;
  if (M && M.length > 0) {
	 lineno = Number(M[1]);
  }
  return lineno;
}

function add_error(err) {
  $('<pre>' + err + '</pre>')
    .click(function () {
		var ln = error_line(err);
		if (ln) editor.gotoLine(ln, false);
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
  $("#editor").css({ bottom: H + 2 });
  editor.resize();
}

function setup(remote) {
  var EditSession = require("ace/edit_session").EditSession;
  var CppMode = require("ace/mode/c_cpp").Mode;

  editor = ace.edit("editor");
  var program = $("#program").html();
  var session = new EditSession(program);
  session.setMode(new CppMode());
  session.setTabSize(2);
  editor.setSession(session);

  $("#configDialog").dialog({
	 autoOpen: false,
	 width: 600,
	 buttons: {
		"D'acord": function() {
		  $(this).dialog("close");
		}
	 },
	 modal: true
  });

  $("#compileButton").button({
	 icons: { primary: 'ui-icon-gear' }
  });

  $("#compileButton").click(function () {
    var code = session.getDocument().getValue();
    remote.compile(code, show_errors);
  });

  $("#settingsButton").button({
	 icons: { primary: 'ui-icon-wrench' }
  });

  $("#settingsButton").button().click(function () {
	 $("#configDialog").dialog('open');
	 return false;
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
