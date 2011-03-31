
function show_errors(errs) {
  $("#errors").html('');
  if (errs.length == 0) {
	 $('<li>No errors</li>').appendTo('#errors');
  } else {
	 for (var i = 0; i < errs.length; i++) {
		$('<li>' + errs[i] + '</li>').appendTo("#errors");
	 }
  }
}

function setup(remote) {
  var editor = ace.edit("editor");
  var CppMode = require("ace/mode/c_cpp").Mode;
  editor.getSession().setMode(new CppMode());

  $("#compile").click(function () {
    var code = editor.getSession().getDocument().getValue();
    remote.compile(code, show_errors);
  });
}

$(document).ready(function () {
  DNode.connect(setup);
});
