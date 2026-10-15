import { AbstractionFinder } from "../../../finders/AbstractionFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { findATypeWord, NO_RESULT, TYPE_PATTERN_SOURCE } from "../../../../inputs/source/text/TypeText.mjs";
import { splitIntoTopLevelPieces } from "../../../../inputs/source/text/TopLevelText.mjs";
import { readParameterName } from "./signatures/ParameterLists.mjs";

const RETURN_BEFORE_PATTERN = new RegExp(`(${TYPE_PATTERN_SOURCE})\\s*$`);
const RETURN_AFTER_A_COLON_PATTERN = new RegExp(`^\\s*:\\s*(${TYPE_PATTERN_SOURCE})`);
const RETURN_AFTER_AN_ARROW_PATTERN = new RegExp(`^\\s*->\\s*(${TYPE_PATTERN_SOURCE})`);

const RETURN_PATTERNS = Object.freeze({ colon: RETURN_AFTER_A_COLON_PATTERN, arrow: RETURN_AFTER_AN_ARROW_PATTERN });

const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/g;

const findResultType = text => {
  const type = findATypeWord(text);
  return type && !NO_RESULT.has(type.replace(/[?!]+$/, "")) ? type : "";
};

export class GenericMethodFinder extends AbstractionFinder {
  constructor() {
    super(Scale.METHOD);
    this.returnTypePlace = null;
    this.parameterNameBeforeType = false;
    this.parameterNameIsTheFirstWord = false;
    this.parameterTypeFollowsTheName = false;
    this.testCallbacks = [];
  }

  isTestCallback(name) {
    return this.testCallbacks.includes(name);
  }

  readReceiverWord() {
    return "";
  }

  findReturnTypes(before, after) {
    if (this.returnTypePlace === "before") {
      const found = RETURN_BEFORE_PATTERN.exec(String(before || "").replace(/\s+$/, ""));
      return found ? [findResultType(found[1])] : [];
    }
    const pattern = RETURN_PATTERNS[this.returnTypePlace] || null;
    const found = pattern ? pattern.exec(String(after || "")) : null;
    return found ? [findResultType(found[1])] : [];
  }

  parseParameterNamesOfAList(text, driver) {
    return this.parameterNameBeforeType ? this.parseParameterNamesBeforeTheirTypes(text) : driver.readParameterNames(`f${text}`);
  }

  parseParameterNamesBeforeTheirTypes(text) {
    const inside = text.trim().replace(/^\(/, "").replace(/\)$/, "");
    return splitIntoTopLevelPieces(inside).flatMap(parameterText => {
      const bare = parameterText.replace(/=[\s\S]*$/, "").replace(/^(?:\.\.\.|\*{1,2})/, "").trim();
      if (/^[{[]/.test(bare)) return [...bare.replace(/:\s*[\w$]+/g, "").matchAll(IDENTIFIER_PATTERN)].map(found => found[0]);
      if (this.parameterNameIsTheFirstWord) return [(/^([A-Za-z_]\w*)/.exec(bare) || [])[1]].filter(Boolean);
      const colon = /([A-Za-z_$][\w$]*)\s*[?!]?\s*:(?!:)/.exec(bare);
      if (colon) return [colon[1]];
      return [readParameterName(bare)].filter(Boolean);
    });
  }
}
