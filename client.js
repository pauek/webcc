
var editor;
var session;

function clear_errors() {
  $("#errors").html('');
}

var prevItem = null;

function highlightItem(item) {
  if (prevItem) {
	 $(prevItem).css({ background: "none" });
  }
  $(item).css({ background: "red", });
  prevItem = item;
}

function errorLine(err) {
  var M = err.match(/^(\d+):(\d+)?:?/);
  var lineno;
  if (M && M.length > 0) {
	 lineno = Number(M[1]);
  }
  return lineno;
}

function addError(err) {
  $('<pre>' + err + '</pre>')
    .click(function () {
		var ln = errorLine(err);
		if (ln) editor.gotoLine(ln, false);
		highlightItem(this);
	 })
	 .appendTo("#errors");
}

function showErrors(errs) {
  clear_errors();
  if (errs.length == 0) {
	 $("#errors").css({ height: 0 });
	 $("#runButton").button("enable");
	 $("#compileButton")
		.button("disable")
		.button({ icons: { primary: 'ui-icon-check' } });
  } else {
	 $("#errors").css({ height: "30%" });
	 $("#runButton").button("disable");
	 for (var i = 0; i < errs.length; i++) {
		addError(errs[i]);
	 }
  }
  var H = $("#errors").height();
  $("#editor").css({ bottom: H + 2 });
  editor.resize();
}

function compileProgram() {
  var code = editor.getSession().getDocument().getValue();
  session.compile(code, showErrors);
}

function showOutput(linesOfOutput) {
  alert(linesOfOutput);
}

function runProgram() {
  if (!$(this).button("option", "disabled")) {
	 session.run("", showOutput);
  }
}

function openSettings() {
  $("#configDialog").dialog('open');
  return false;
}

function sessionStart(_session) {
  session = _session;
  $("#compileButton").button("enable");
}

function sourceCodeChanged() {
  $("#compileButton")
	 .button("enable")
	 .button({ icons: { primary: 'ui-icon-gear' } });
  $("#runButton").button("disable");
}

function setup(remote) {
  var EditSession = require("ace/edit_session").EditSession;
  var CppMode = require("ace/mode/c_cpp").Mode;

  editor = ace.edit("editor");
  var program = $("#program").html();
  var session = new EditSession(program);
  session.setMode(new CppMode());
  session.setTabSize(2);
  session.on('change', sourceCodeChanged);
  editor.setSession(session);

  $("#configDialog").dialog({
	 autoOpen: false,
	 modal: true,
	 width: 600,
	 height: 420,
	 buttons: {
		"D'acord": function() {
		  $(this).dialog("close");
		}
	 },
  });

  $("#compileButton")
	 .button({ icons: { primary: 'ui-icon-gear' } })
	 .button("disable")
	 .click(compileProgram);

  $("#runButton")
	 .button({ icons: { primary: 'ui-icon-play' } })
	 .button("disable")
	 .click(runProgram);
  
  $("#settingsButton")
	 .button({ icons: { primary: 'ui-icon-wrench' } })
    .click(openSettings);

  $("#errors").resize(function () {
	 var y = $("body").height() - $("#errors").height();
    alert(y);
	 $("#editor").css({ bottom: y });
  });

  remote.startSession(sessionStart);
}

$(document).ready(function () {
  DNode.connect(setup);
});
