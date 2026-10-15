import { escapeForAPattern, findClosingParenthesis, parseType } from "../../../../../code/index.mjs";

const NAME_SOURCE = "[A-Za-z_$][\\w$]*";

const CHAIN_STEP_PATTERN = new RegExp(`^\\s*(?:[?!]?\\.|::)\\s*(${NAME_SOURCE})|^\\s*(\\[)|^\\s*(!!)`);

const CALL_OPENING_PATTERN = /^\s*\(/;

const TRAILING_BLOCK_PATTERN = new RegExp(`^\\s*(?:\\{\\s*(?:\\|\\s*(${NAME_SOURCE})\\s*\\||\\(?\\s*(${NAME_SOURCE})\\s*\\)?\\s*(?:->|\\bin\\b))|do\\s*\\|\\s*(${NAME_SOURCE})\\s*\\|)`);

const LAMBDA_HEAD_PATTERNS = [
  new RegExp(`^\\s*\\(?\\s*(?:[\\w$.<>\\[\\]]+\\s+)?(${NAME_SOURCE})\\s*\\)?\\s*(?:->|=>)`),
  new RegExp(`^\\s*(?:move\\s+)?\\|\\s*&?(${NAME_SOURCE})\\s*(?::[^|]*)?\\|`),
  new RegExp(`^\\s*lambda\\s+(${NAME_SOURCE})\\s*:`),
  new RegExp(`^\\s*(?:func|function)\\s*\\(\\s*(${NAME_SOURCE})\\b`),
];

const LAMBDA_HEADS_ANYWHERE_PATTERN = new RegExp(`\\(?\\s*(?:[\\w$.<>\\[\\]]+\\s+)?${NAME_SOURCE}\\s*\\)?\\s*(?:->|=>)|\\|\\s*&?${NAME_SOURCE}\\s*\\||\\blambda\\s+${NAME_SOURCE}\\s*:`, "g");

const METHOD_REFERENCE_PATTERN = new RegExp(`^\\s*[\\w$.]*::\\s*(${NAME_SOURCE})\\s*$`);

const DECLARING_WORDS_SOURCE = "(?:(?:final|const|let|var|val|auto|mut)\\s+)*";

const LOOP_TYPE_SOURCE = "(?:[\\w$.]+(?:<[^<>]*(?:<[^<>]*>[^<>]*)*>)?(?:\\[\\s*\\])*[?*&]?\\s+)?";

const ASSIGNMENT_PATTERN = new RegExp(`^\\s*${DECLARING_WORDS_SOURCE}(?:([A-Z][\\w$.]*(?:<.*>)?(?:\\[\\s*\\])*[?*&]?)\\s+)?(${NAME_SOURCE})\\s*(?::\\s*([^=]+?))?\\s*:?=(?![=>])(.*)$`);

const END_OF_A_STATEMENT_PATTERN = /^\s*;?\s*$/;

const CONTINUING_LINE_PATTERN = /^\s*(?:[?!]?\.|::)(?!\.)/;

const WORDS_NEVER_A_NAME = new Set(["_", "it", "this", "self", "return", "new", "await", "yield"]);

const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);

const buildMemberReadWords = members => new Set(members.flatMap(member => [member, `get${capitalize(member)}`, `is${capitalize(member)}`]));

const buildUsePattern = name => new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}(?![\\w$])`, "g");

const buildLoopPatterns = name => [
  new RegExp(`\\b(?:for|foreach)\\s*\\(?\\s*${DECLARING_WORDS_SOURCE}${LOOP_TYPE_SOURCE}\\(?\\s*(${NAME_SOURCE})\\s*\\)?\\s*(?::(?!:)|\\bin\\b|\\bof\\b)\\s*&?\\s*(?:mut\\s+)?(?=${escapeForAPattern(name)}(?![\\w$]))`),
  new RegExp(`\\bfor\\s+${NAME_SOURCE}\\s*,\\s*(${NAME_SOURCE})\\s*:?=\\s*range\\s+&?(?=${escapeForAPattern(name)}(?![\\w$]))`),
];

const NO_OPENING = -1;

const findTheOpeningOfTheStep = (text, step, afterTheStep) => {
  if (step[3]) return NO_OPENING;
  if (step[2]) return afterTheStep - 1;
  const call = CALL_OPENING_PATTERN.exec(text.slice(afterTheStep));
  return call ? afterTheStep + call[0].length - 1 : NO_OPENING;
};

const findLambdaName = argumentText => {
  for (const pattern of LAMBDA_HEAD_PATTERNS) {
    const found = pattern.exec(argumentText);
    if (found) return found[1];
  }
  return "";
};

const findTrailingBlockName = text => {
  const found = TRAILING_BLOCK_PATTERN.exec(text);
  return found ? found[1] || found[2] || found[3] : "";
};

export const readTheContinuedText = (lines, line, lastLine) => {
  const texts = [String(lines[line - 1] || "")];
  for (let next = line + 1; next <= lastLine && CONTINUING_LINE_PATTERN.test(String(lines[next - 1] || "")); next++) texts.push(String(lines[next - 1] || ""));
  return texts.join(" ");
};

export const removeTheLambdaHeads = text => text.replace(LAMBDA_HEADS_ANYWHERE_PATTERN, " ");

export class ParameterNamesInTheBody {
  constructor(parameter, typeName, members) {
    this.names = new Set([parameter]);
    this.typeName = typeName;
    this.memberReadWords = buildMemberReadWords(members);
  }

  list() {
    return [...this.names];
  }

  readTheChainAfter(text, from) {
    const found = { end: from, readsAMember: false, lambdaNames: [], referencedMembers: [] };
    let at = from;
    for (;;) {
      const step = CHAIN_STEP_PATTERN.exec(text.slice(at));
      if (!step) break;
      if (step[1] && this.memberReadWords.has(step[1])) { found.readsAMember = true; break; }
      const afterTheStep = at + step[0].length;
      const opening = findTheOpeningOfTheStep(text, step, afterTheStep);
      if (opening < 0) {
        at = afterTheStep;
      } else {
        const closing = this.readTheArgumentsAt(text, opening, found);
        if (closing < 0) break;
        at = closing + 1;
      }
      const trailing = findTrailingBlockName(text.slice(at));
      if (trailing) found.lambdaNames.push(trailing);
    }
    found.end = at;
    return found;
  }

  readTheArgumentsAt(text, opening, found) {
    const lambdaName = text[opening] === "(" ? findLambdaName(text.slice(opening + 1)) : "";
    if (lambdaName) found.lambdaNames.push(lambdaName);
    const closing = findClosingParenthesis(text, opening);
    const reference = closing < 0 ? null : METHOD_REFERENCE_PATTERN.exec(text.slice(opening + 1, closing));
    if (reference && this.memberReadWords.has(reference[1])) found.referencedMembers.push(reference[1]);
    return closing;
  }

  findUsesIn(text) {
    return this.list().flatMap(name => [...text.matchAll(buildUsePattern(name))].map(use => ({ name, at: use.index, end: use.index + name.length })));
  }

  isTheTypeText(typeText) {
    const type = parseType(typeText || "");
    return Boolean(type) && !type.collection && type.simple === this.typeName;
  }

  findTheAssignedName(text) {
    const assigned = ASSIGNMENT_PATTERN.exec(text);
    if (!assigned) return "";
    const rhs = assigned[4];
    const offset = text.length - rhs.length;
    const uses = this.findUsesIn(rhs);
    if (!uses.length) return "";
    if (this.isTheTypeText(assigned[1] || assigned[3])) return assigned[2];
    const [first] = uses;
    if (rhs.slice(0, first.at).trim()) return "";
    const chain = this.readTheChainAfter(text, offset + first.end);
    return !chain.readsAMember && END_OF_A_STATEMENT_PATTERN.test(text.slice(chain.end)) ? assigned[2] : "";
  }

  findTheLoopNames(text) {
    return this.list().flatMap(name => buildLoopPatterns(name).map(pattern => {
      const loop = pattern.exec(text);
      if (!loop) return "";
      return this.readTheChainAfter(text, loop.index + loop[0].length + name.length).readsAMember ? "" : loop[1];
    }));
  }

  readTheChainsOfTheUses(text) {
    return this.findUsesIn(text).map(use => this.readTheChainAfter(text, use.end)).filter(chain => !chain.readsAMember);
  }

  isUsedWithoutAMemberRead(text) {
    return this.readTheChainsOfTheUses(text).length > 0;
  }

  findTheNamesIntroducedBy(continuedText) {
    const chains = this.readTheChainsOfTheUses(continuedText);
    const introduced = [this.findTheAssignedName(continuedText), ...this.findTheLoopNames(continuedText), ...chains.flatMap(chain => chain.lambdaNames)]
      .filter(name => name && !WORDS_NEVER_A_NAME.has(name) && !this.memberReadWords.has(name) && !this.names.has(name));
    return { introduced: [...new Set(introduced)], referencedMembers: chains.flatMap(chain => chain.referencedMembers) };
  }

  add(names) {
    for (const name of names) this.names.add(name);
  }
}
