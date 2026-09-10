import { CALL_FORMS } from "../../../../graph/relations/Reference.mjs";
import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

const OBJC_SEND_PATTERN = /\[\s*([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*[:\]]/g;

function sendCalls(code, from) {
  const calls = [];
  for (const found of code.matchAll(OBJC_SEND_PATTERN)) {
    if (found.index < from) continue;
    calls.push({ col: found.index, form: CALL_FORMS.SEND, callee: found[2], receiver: found[1], qualifier: "", root: found[1], chained: false, opening: -1, block: false, args: null, firstArgument: "" });
  }
  return calls;
}

export class ObjectiveCMethodRelationFinder extends GenericMethodRelationFinder {
  language = "objc";
  receiverSeparators = ["->"];
  methodHeads = "typed";
  cStyleCasts = true;

  findMoreCallsOnLine(text, from) {
    return sendCalls(text, from);
  }
}
