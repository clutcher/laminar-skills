import { isAText, isATestFileOfTheModel, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { readMethodBodyStatements } from "./BodyCalls.mjs";
import { TOKEN_KINDS, isClosingMark, isOpeningMark, isTheMark, isTheName, readCodeTokens } from "./CodeText.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

// The words that join 2 conditions: && and || of Java, Kotlin, JavaScript and TypeScript, and and and or of Python.
const JOINING_WORDS = new Set(["&&", "||", "and", "or"]);

// The words that negate a condition: ! of the brace languages, and not of Python, also inside is not and not in.
const NEGATING_WORDS = new Set(["!", "not"]);

// Each comparison and the comparison that negates it, so a guard that throws and a return that negates it read as 1 condition.
const NEGATED_COMPARISON_MAP = new Map([["!=", "=="], [">=", "<"], ["<=", ">"]]);

// The receiver of the object itself in Java, Kotlin, JavaScript, TypeScript and Python, which a condition may write before the part it reads.
const SELF_WORDS = new Set(["this", "self"]);

// The words that open a condition head: if of every read language and elif of Python.
const CONDITION_WORDS = new Set(["if", "elif"]);

const RETURN_WORD = "return";

const CONDITIONS_OF_A_REPEAT = 2;

const BUSINESS_RULES_OF_AN_ANSWER = 2;

// The marks that stand against the token before them, and the marks that stand against the token after them, when a condition is shown.
const MARKS_WITH_NO_SPACE_BEFORE = new Set(["(", ")", ".", ",", "[", "]", "?."]);

const MARKS_WITH_NO_SPACE_AFTER = new Set(["(", ".", "[", "?."]);

const findTheCloseAt = (tokens, openAt) => {
  let depth = 0;
  for (let at = openAt; at < tokens.length; at += 1) {
    if (isOpeningMark(tokens[at])) depth += 1;
    else if (isClosingMark(tokens[at])) {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return tokens.length;
};

const isAJoiningWord = token => Boolean(token) && JOINING_WORDS.has(token.text);

const isANegatingWord = token => Boolean(token) && NEGATING_WORDS.has(token.text);

const dropTheLineEnds = tokens => tokens.filter(token => token.kind !== TOKEN_KINDS.LINE_END);

// The head of a condition in parentheses, as the brace languages write it, or up to the colon or the line end, as Python writes it.
const readConditionHeadAt = (tokens, wordAt) => {
  if (isTheMark(tokens[wordAt + 1], "(")) return dropTheLineEnds(tokens.slice(wordAt + 2, findTheCloseAt(tokens, wordAt + 1)));

  let depth = 0;
  for (let at = wordAt + 1; at < tokens.length; at += 1) {
    if (isOpeningMark(tokens[at])) depth += 1;
    else if (isClosingMark(tokens[at])) depth -= 1;
    else if (depth === 0 && (isTheMark(tokens[at], ":") || tokens[at].kind === TOKEN_KINDS.LINE_END)) return tokens.slice(wordAt + 1, at);
  }
  return tokens.slice(wordAt + 1);
};

// A line end inside a returned expression goes on where a joining word stands before or after it.
const isTheEndOfTheReturn = (tokens, at) => {
  if (isTheMark(tokens[at], ";")) return true;
  if (tokens[at].kind !== TOKEN_KINDS.LINE_END) return false;

  const next = tokens.slice(at + 1).find(token => token.kind !== TOKEN_KINDS.LINE_END);
  return !isAJoiningWord(tokens[at - 1]) && !isAJoiningWord(next);
};

const readReturnedExpressionAt = (tokens, wordAt) => {
  let depth = 0;
  for (let at = wordAt + 1; at < tokens.length; at += 1) {
    if (isOpeningMark(tokens[at])) depth += 1;
    else if (isClosingMark(tokens[at])) {
      if (depth === 0) return dropTheLineEnds(tokens.slice(wordAt + 1, at));
      depth -= 1;
    } else if (depth === 0 && isTheEndOfTheReturn(tokens, at)) return dropTheLineEnds(tokens.slice(wordAt + 1, at));
  }
  return dropTheLineEnds(tokens.slice(wordAt + 1));
};

const isWrappedInParentheses = tokens => isTheMark(tokens[0], "(") && findTheCloseAt(tokens, 0) === tokens.length - 1;

const dropTheNegationsAndParentheses = tokens => {
  let unwrapped = tokens;
  while (unwrapped.length && (isANegatingWord(unwrapped[0]) || isWrappedInParentheses(unwrapped))) unwrapped = isANegatingWord(unwrapped[0]) ? unwrapped.slice(1) : unwrapped.slice(1, -1);
  return unwrapped;
};

const splitAtTheJoiningWords = tokens => {
  const pieces = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (isOpeningMark(token)) depth += 1;
    else if (isClosingMark(token)) depth -= 1;
    if (depth === 0 && isAJoiningWord(token)) pieces.push([]);
    else pieces[pieces.length - 1].push(token);
  }
  return pieces.filter(piece => piece.length > 0);
};

const isASelfReceiverAt = (tokens, at) => SELF_WORDS.has(tokens[at].text) && isTheMark(tokens[at + 1], ".");

// A condition with its negations, the negation of its comparison and the receiver of the object itself taken out, so !onHold, onHold and this.onHold read as 1 condition.
const normalizeTheCondition = tokens => tokens
  .filter((token, at) => !isANegatingWord(token) && !isASelfReceiverAt(tokens, at) && !(isTheMark(token, ".") && at > 0 && isASelfReceiverAt(tokens, at - 1)))
  .map(token => ({ ...token, text: NEGATED_COMPARISON_MAP.get(token.text) || token.text }));

const showTheCondition = tokens => tokens.reduce((shown, token, at) => {
  const touchesTheTokenBefore = at === 0 || MARKS_WITH_NO_SPACE_BEFORE.has(token.text) || MARKS_WITH_NO_SPACE_AFTER.has(tokens[at - 1].text);
  return `${shown}${touchesTheTokenBefore ? "" : " "}${token.text}`;
}, "");

// The single conditions of a condition head, each split off at a joining word and with its negation taken out, so a guard per condition and a return that joins them give the same conditions.
const listSingleConditions = tokens => {
  const unwrapped = dropTheNegationsAndParentheses(tokens);
  const pieces = splitAtTheJoiningWords(unwrapped);
  if (pieces.length > 1) return pieces.flatMap(listSingleConditions);
  return unwrapped.length ? [normalizeTheCondition(unwrapped)] : [];
};

// A returned expression is a condition where it joins conditions or negates 1, because a return of a plain value decides nothing.
const isAReturnedCondition = tokens => isANegatingWord(tokens[0]) || splitAtTheJoiningWords(tokens).length > 1;

const listConditionHeads = tokens => {
  const heads = [];
  tokens.forEach((token, at) => {
    if (token.kind !== TOKEN_KINDS.NAME) return;
    if (CONDITION_WORDS.has(token.text)) heads.push(readConditionHeadAt(tokens, at));
    else if (token.text === RETURN_WORD) {
      const returned = readReturnedExpressionAt(tokens, at);
      if (isAReturnedCondition(returned)) heads.push(returned);
    }
  });
  return heads;
};

const listMemberNames = theClass => new Set([...readList(theClass.fields), ...readList(theClass.methods)].map(member => member.name).filter(isAText));

// The parameters of the method and the locals of its body, which 2 bodies may name apart for the same value.
const listOwnValueNames = (method, statements) => new Set([
  ...readList(method.parameters).map(parameter => parameter.name),
  ...statements.flatMap(statement => [...statement.declarations, ...statement.loopVariables, ...statement.patternVariables, ...statement.lambdaParameters]).map(declaration => declaration.name),
]);

const OWN_VALUE_MARK = "_";

// The key of a condition writes each parameter and each local as 1 mark, so isBlocked(fines) and isBlocked(owedFines) read as 1 condition.
const readTheConditionKey = (tokens, ownValueNames) => tokens.map(token => (token.kind === TOKEN_KINDS.NAME && ownValueNames.has(token.text) ? OWN_VALUE_MARK : token.text)).join(" ");

const readsAPartOfTheClass = (tokens, memberNames) => tokens.some(token => token.kind === TOKEN_KINDS.NAME && memberNames.has(token.text));

// The conditions of a body that read a field or a method of its class, each with its key and its text, sorted by key; a check of a parameter alone is no condition over the parts of the class.
const listConditionsOverTheParts = (theClass, method, statements, memberNames) => {
  const ownValueNames = listOwnValueNames(method, statements);
  const conditionOfKeyMap = new Map();
  for (const condition of listConditionHeads(readCodeTokens(method.body, theClass.file)).flatMap(listSingleConditions)) {
    if (readsAPartOfTheClass(condition, memberNames)) conditionOfKeyMap.set(readTheConditionKey(condition, ownValueNames), showTheCondition(condition));
  }
  return [...conditionOfKeyMap.keys()].sort().map(key => ({ key, text: conditionOfKeyMap.get(key) }));
};

const listCalledNames = (method, statements) => new Set([
  ...statements.flatMap(statement => statement.calls).filter(call => call.shape === "own").map(call => call.memberName),
  ...readList(method.uses),
]);

const joinTheKeys = conditions => conditions.map(condition => condition.key).join("\n");

const isTheSameConditionSet = (conditions, otherConditions) => conditions.length >= CONDITIONS_OF_A_REPEAT && joinTheKeys(conditions) === joinTheKeys(otherConditions);

const holdsEveryCondition = (conditions, otherConditions) => conditions.every(condition => otherConditions.some(other => other.key === condition.key));

// 2 bodies share 1 owner of the conditions where 1 calls the other, or where both call 1 named part of the class whose own conditions hold them all.
const shareAnOwner = (first, second, bodies) => first.calledNames.has(second.method.name)
  || second.calledNames.has(first.method.name)
  || bodies.some(part => part !== first && part !== second && first.calledNames.has(part.method.name) && second.calledNames.has(part.method.name) && holdsEveryCondition(first.conditions, part.conditions));

const readBusinessRuleKey = rule => rule.trim().replace(/\s+/g, " ").toLowerCase();

// An answer under scriptCases clears the case only where businessRules names exactly 2 business rules whose texts differ, because 2 names for 1 rule say nothing about why the 2 bodies only look alike.
export const namesTwoBusinessRules = scriptCase => {
  const rules = readList(scriptCase.businessRules);
  if (rules.length !== BUSINESS_RULES_OF_AN_ANSWER || !rules.every(isAText)) return false;

  return readBusinessRuleKey(rules[0]) !== readBusinessRuleKey(rules[1]);
};

const describeTheRepeat = (model, theClass, first, second) => `${model.getMethodDisplayName(theClass, first.method)} and ${model.getMethodDisplayName(theClass, second.method)} test the same ${first.conditions.length} conditions, ${first.conditions.map(condition => `\`${condition.text}\``).join(", ")}, and neither calls the other, so 1 business rule can stand in 2 bodies: let 1 body call the other, or move the conditions into 1 named part that both call, or answer under scriptCases with businessRules, the 2 business rules, and a reason that says why the 2 bodies only look alike`;

const createTheRepeatDefect = (model, theClass, first, second) => ({
  ...createRecheckDefect(DEFECT_CODES.REPEATED_CONDITIONS, model.getMethodPath(theClass, first.method), describeTheRepeat(model, theClass, first, second)),
  answerTest: (_model, _theClass, _reason, scriptCase) => namesTwoBusinessRules(scriptCase),
});

const listBodiesWithConditions = theClass => {
  const memberNames = listMemberNames(theClass);
  return readList(theClass.methods)
    .filter(method => isAText(method.body) && !isMarkedUnchanged(method))
    .map(method => {
      const statements = readMethodBodyStatements(method);
      return { method, conditions: listConditionsOverTheParts(theClass, method, statements, memberNames), calledNames: listCalledNames(method, statements) };
    });
};

// 2 bodies of 1 class of the model that test the same 2 or more conditions over the parts of the class, with no call between them, write 1 business rule twice, and a new condition must then be added to both. It is a recheck case, because code that looks the same can be 2 business rules.
export const findRepeatedConditionDefects = model => {
  const defects = [];
  for (const theClass of model.classes.filter(other => !isATestFileOfTheModel(model, other.file || ""))) {
    const bodies = listBodiesWithConditions(theClass);
    bodies.forEach((first, at) => {
      for (const second of bodies.slice(at + 1)) {
        if (isTheSameConditionSet(first.conditions, second.conditions) && !shareAnOwner(first, second, bodies)) defects.push(createTheRepeatDefect(model, theClass, first, second));
      }
    });
  }
  return defects;
};
