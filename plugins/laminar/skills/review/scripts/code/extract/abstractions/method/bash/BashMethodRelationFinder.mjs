import { CALL_FORMS } from "../../../../graph/relations/Reference.mjs";
import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

const SHELL_WORDS = new Set(["if", "then", "else", "elif", "fi", "for", "in", "do", "done", "while", "until", "case", "esac",
  "function", "select", "time", "echo", "printf", "read", "test", "let", "local", "declare", "export", "set", "unset", "shift",
  "cd", "pwd", "source", "true", "false", "return", "break", "continue", "exit", "eval", "exec", "trap", "wait", "readonly",
  "typeset", "alias", "unalias", "builtin", "command", "type", "getopts", "hash", "ulimit", "umask", "shopt"]);

const SHELL_COMMAND_PATTERN = /(?<=(?:^|[|;&(`]|\bthen|\bdo|\belse)\s*)([A-Za-z_][\w.-]*)/g;

function findCommandCalls(code, from) {
  const calls = [];
  for (const found of code.matchAll(SHELL_COMMAND_PATTERN)) {
    const callee = found[1];
    const at = found.index;
    if (at < from || SHELL_WORDS.has(callee) || code[at + callee.length] === "=") continue;
    calls.push({ col: at, form: CALL_FORMS.COMMAND, callee, receiver: "", qualifier: "", root: "", chained: false, opening: -1, block: false, args: null, firstArgument: "" });
  }
  return calls;
}

export class BashMethodRelationFinder extends GenericMethodRelationFinder {
  language = "bash";

  findCallsOnLine(text, from) {
    return findCommandCalls(text, from);
  }
}
