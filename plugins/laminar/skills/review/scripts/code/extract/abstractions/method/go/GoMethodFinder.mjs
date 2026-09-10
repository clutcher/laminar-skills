import { NO_RESULT, splitTopLevelArguments } from "../../../../inputs/source/text/TypeText.mjs";
import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export function parseGoResults(after) {
  const text = after.trim().replace(/(?<!struct|interface)\s*\{.*$/, "").trim();
  if (!text) return [];
  const inside = /^\((.*)\)$/.exec(text);
  const resultTexts = inside ? splitTopLevelArguments(inside[1]) : [text];
  return resultTexts.map(resultText => resultText.trim().split(/\s+/).pop()).map(resultText => (resultText !== "error" && NO_RESULT.has(resultText) ? "" : resultText));
}

export class GoMethodFinder extends GenericMethodFinder {
  language = "golang";
  parameterNameIsTheFirstWord = true;
  parameterTypeFollowsTheName = true;
  parameterNameBeforeType = true;

  findReturnTypes(before, after) {
    return parseGoResults(after);
  }
}
