import { NO_RESULT, splitTopLevelArguments } from "../../../../inputs/source/text/TypeText.mjs";
import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export function parseGoResults(after) {
  const text = after.trim().replace(/(?<!struct|interface)\s*\{.*$/, "").trim();
  if (!text) return [];
  const inside = /^\((.*)\)$/.exec(text);
  const resultTexts = inside ? splitTopLevelArguments(inside[1]) : [text];
  return resultTexts.map(resultText => resultText.trim().split(/\s+/).pop()).map(resultText => (resultText !== "error" && NO_RESULT.has(resultText) ? "" : resultText));
}

const RECEIVER_OF_A_METHOD_HEAD_PATTERN = /^\s*func\s*\(\s*([A-Za-z_]\w*)\s+\*?\s*[A-Za-z_]/;

export class GoMethodFinder extends GenericMethodFinder {
  language = "golang";
  parameterNameIsTheFirstWord = true;
  parameterTypeFollowsTheName = true;
  parameterNameBeforeType = true;

  findReturnTypes(before, after) {
    return parseGoResults(after);
  }

  readReceiverWord(headText) {
    return (RECEIVER_OF_A_METHOD_HEAD_PATTERN.exec(headText) || ["", ""])[1];
  }
}
