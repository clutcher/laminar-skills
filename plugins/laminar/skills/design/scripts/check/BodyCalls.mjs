import { splitAtTopLevelCommas } from "../model/TypeArguments.mjs";
import { QUOTES, findEndOfTheString, readQuoteAt } from "./CodeText.mjs";

const CALL_START = /(\bnew\s+)?([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\(/g;

const DECLARATION = /^\s*(?:(?:final|const|let|var)\s+)?(?:([A-Za-z_$][\w$.]*(?:<[^=]*>)?(?:\[\])?)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=(?!=)/;

// The words that can stand before a declared name in Java, JavaScript and TypeScript, the languages the data-flow check reads.
const DECLARING_WORDS = new Set([
  "final", // Java: a local that is assigned once
  "const", // JavaScript and TypeScript: a binding that is assigned once
  "let", // JavaScript and TypeScript: a binding that may change
  "var", // Java 10 and later, JavaScript and TypeScript: a local whose type the compiler infers
  "return", // all 3: a returned expression, which declares no name
]);

// The keywords of Java, JavaScript and TypeScript that a parenthesis can follow without a call.
const WORDS_THAT_OPEN_NO_CALL = new Set([
  "if", // all 3: a condition
  "for", // all 3: a loop head
  "while", // all 3: a loop head
  "switch", // all 3: a selector
  "catch", // all 3: a caught failure
  "return", // all 3: a returned expression in parentheses
  "function", // JavaScript and TypeScript: a function expression
  "typeof", // JavaScript and TypeScript: a type query
  "await", // JavaScript and TypeScript: an awaited expression in parentheses
  "throw", // all 3: a thrown expression in parentheses
  "try", // Java: the resources of a try-with-resources
  "synchronized", // Java: the lock of a synchronized block
]);

// The receiver of the object itself in Java, JavaScript and TypeScript, which a call chain skips to reach the field it names.
const SELF_WORDS = new Set(["this"]);

const OPENING = "([{";

const CLOSING = ")]}";

const readCharacterBefore = (text, at) => {
  let before = at - 1;
  while (before >= 0 && /\s/.test(text[before])) before -= 1;
  return before >= 0 ? text[before] : "";
};

const readArgumentTexts = (text, openAt) => {
  const argumentTexts = [];
  let depth = 0;
  let quote = "";
  let start = openAt + 1;
  for (let at = openAt; at < text.length; at += 1) {
    const character = text[at];
    if (quote) {
      if (character === "\\") at += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (QUOTES.includes(character)) quote = character;
    else if (OPENING.includes(character)) depth += 1;
    else if (CLOSING.includes(character)) {
      depth -= 1;
      if (depth === 0) {
        argumentTexts.push(text.slice(start, at).trim());
        return argumentTexts.filter(argumentText => argumentText.length > 0);
      }
    } else if (character === "," && depth === 1) {
      argumentTexts.push(text.slice(start, at).trim());
      start = at + 1;
    }
  }
  return argumentTexts.filter(argumentText => argumentText.length > 0);
};

const readNameChain = chainText => {
  const names = chainText.split(".").map(name => name.trim());
  return SELF_WORDS.has(names[0]) && names.length > 1 ? names.slice(1) : names;
};

const createCall = (isConstructor, names, argumentTexts) => {
  if (isConstructor) return { shape: "constructor", className: names[names.length - 1], argumentTexts };
  if (names.length === 1) return { shape: "own", memberName: names[0], argumentTexts };
  return { shape: "member", receiver: names[0], memberName: names[names.length - 1], chainLength: names.length, argumentTexts };
};

const readCallsOfTheText = text => {
  const calls = [];
  for (const match of text.matchAll(CALL_START)) {
    const names = readNameChain(match[2]);
    if (WORDS_THAT_OPEN_NO_CALL.has(names[0]) && names.length === 1) continue;

    const before = readCharacterBefore(text, match.index);
    if (before === "." || before === ")") continue;

    const openAt = match.index + match[0].length - 1;
    const isConstructor = Boolean(match[1]) || (names.length === 1 && /^[A-Z]/.test(names[0]));
    calls.push(createCall(isConstructor, names, readArgumentTexts(text, openAt)));
  }
  return calls;
};

const FOR_EACH = /\bfor\s*\(\s*(?:final\s+)?(?:(?:const|let|var|val)\s+)?(?:[{[]([^}\]]*)[}\]]|(?:[\w$.<>[\]?, ]+?\s+)?([A-Za-z_$][\w$]*))\s*(?::(?!:)|\s+of\s|\s+in\s)/;

// The head of a try-with-resources and of an indexed loop, after which a resource or a loop variable is declared as a local is.
const LOOP_OR_RESOURCE_HEAD = /^\s*(?:try|for)\s*\(/;

const CATCH = /\bcatch\s*\(\s*(?:final\s+)?(?:([\w$.<>|\s]+?)\s+)?([A-Za-z_$][\w$]*)\s*(?::[^)]*)?\)/g;

// A Java pattern variable, declared by a type pattern of instanceof or of a case.
const PATTERN_VARIABLES = [/\binstanceof\s+([\w$.<>]+)\s+([a-z_$][\w$]*)/g, /\bcase\s+([A-Z][\w$.<>]*)\s+([a-z_$][\w$]*)\s*(?:->|:|\bwhen\b)/g];

const DESTRUCTURING = /^\s*(?:(?:const|let|var|final|val)\s+)?[{[]([^}\]]*)[}\]]\s*(?::[^=]+)?=(?!=)/;

const LAMBDA_PARAMETER_LIST = /\(([^()]*)\)\s*(?:->|=>)/g;

const LAMBDA_PARAMETER = /([A-Za-z_$][\w$]*)\s*(?:->|=>)/g;

const LAST_NAME = /([A-Za-z_$][\w$]*)\s*$/;

const createDeclaration = (name, typeText = "") => ({ name, typeText });

const readSimpleDeclaration = statement => {
  const match = DECLARATION.exec(statement);
  if (!match || DECLARING_WORDS.has(match[2])) return [];

  const typeText = match[1] && !DECLARING_WORDS.has(match[1]) ? match[1] : "";
  return [createDeclaration(match[2], typeText)];
};

const readDestructuredNames = listText => listText.split(",").flatMap(piece => {
  const target = piece.split("=")[0].split(":").pop().replace(/^\s*\.\.\./, "").trim();
  return /^[A-Za-z_$][\w$]*$/.test(target) ? [createDeclaration(target)] : [];
});

const readCatchVariables = statement => [...statement.matchAll(CATCH)].map(match => createDeclaration(match[2], match[1] ? match[1].trim() : ""));

const readDeclarations = statement => {
  const destructuring = DESTRUCTURING.exec(statement);
  if (destructuring) return readDestructuredNames(destructuring[1]);
  if (FOR_EACH.test(statement)) return [];
  return [...readSimpleDeclaration(statement.replace(LOOP_OR_RESOURCE_HEAD, "")), ...readCatchVariables(statement)];
};

// The variable of a for-each, which its loop body reads in the same statement where the loop has no braces, so it is known before the calls of the statement.
const readLoopVariables = statement => {
  const forEach = FOR_EACH.exec(statement);
  if (!forEach) return [];
  return forEach[1] === undefined ? [createDeclaration(forEach[2])] : readDestructuredNames(forEach[1]);
};

// A pattern variable, which its condition can read in the same statement, so it is known before the calls of the statement.
const readPatternVariables = statement => PATTERN_VARIABLES.flatMap(pattern => [...statement.matchAll(pattern)].map(match => createDeclaration(match[2], match[1])));

const readLambdaParameters = statement => {
  const names = [];
  for (const match of statement.matchAll(LAMBDA_PARAMETER_LIST)) {
    for (const parameter of splitAtTopLevelCommas(match[1])) {
      const name = LAST_NAME.exec(parameter);
      if (name) names.push(name[1]);
    }
  }
  for (const match of statement.matchAll(LAMBDA_PARAMETER)) names.push(match[1]);
  return names.map(name => createDeclaration(name));
};

const readParenthesisDepthChange = line => {
  let change = 0;
  let quote = "";
  for (let at = 0; at < line.length; at += 1) {
    const character = line[at];
    if (quote) {
      if (character === "\\") at += 1;
      else if (character === quote) quote = "";
    } else if (QUOTES.includes(character)) quote = character;
    else if (character === "(" || character === "[") change += 1;
    else if (character === ")" || character === "]") change -= 1;
  }
  return change;
};

// The text inside every string, dropped with its quotes kept as an empty string, so a call or a ; inside a string or a text block is no code and the string still reads as a literal.
const blankTheStringTexts = body => {
  let blanked = "";
  let at = 0;
  while (at < body.length) {
    const quote = readQuoteAt(body, at);
    if (!quote) {
      blanked += body[at];
      at += 1;
      continue;
    }

    blanked += `${quote[0]}${quote[0]}`;
    at = findEndOfTheString(body, at, quote);
  }
  return blanked;
};

const splitStatements = body => {
  const statements = [];
  let open = "";
  let depth = 0;
  for (const line of body.split("\n")) {
    open = open ? `${open} ${line.trim()}` : line;
    depth += readParenthesisDepthChange(line);
    if (depth > 0) continue;

    statements.push(...open.split(";"));
    open = "";
    depth = 0;
  }
  if (open) statements.push(...open.split(";"));
  return statements.map(statement => statement.trim()).filter(statement => statement.length > 0);
};

export const readBodyStatements = body => splitStatements(blankTheStringTexts(body)).map(text => ({
  text,
  calls: readCallsOfTheText(text),
  declarations: readDeclarations(text),
  loopVariables: readLoopVariables(text),
  patternVariables: readPatternVariables(text),
  lambdaParameters: readLambdaParameters(text),
}));

// The words that may stand before the name of a method on its signature line: modifiers, annotations and a return type with its type arguments.
const SIGNATURE_PREFIX = /^[\w$\s<>[\],.?@]*$/;

// The keywords of Java, JavaScript and TypeScript that start an expression, so a name after them is a call and no declaration.
const EXPRESSION_KEYWORDS = /\b(?:return|new|await|throw|yield|else|case)\b/;

// After the parameter list, a signature line holds a body brace, a return type, a throws clause or an arrow, and never a statement end.
const DECLARATION_MARK = /[{:]|\bthrows\b|=>/;

const escapeForRegExp = text => text.replace(/[$]/g, "\\$");

const findEndOfTheParameterList = (line, openAt) => {
  let depth = 0;
  for (let at = openAt; at < line.length; at += 1) {
    if (line[at] === "(") depth += 1;
    else if (line[at] === ")") depth -= 1;
    if (depth === 0) return at;
  }
  return -1;
};

// The name a parameter of a signature declares: before the colon of its type in TypeScript and Kotlin, else its last word, as in Java.
const readDeclaredParameterName = parameterText => {
  const declared = parameterText.split("=")[0];
  const named = declared.includes(":") ? declared.split(":")[0] : declared;
  const words = named.trim().split(/\s+/);
  return words[words.length - 1].replace(/^\.\.\./, "").replace(/\?$/, "");
};

// A line is the signature of the method where it names the method before its parameter list, declares the parameters of the model in their order, and holds a type, a modifier or a declaration mark, so a call of the method by its own parameters stays a call.
const isTheSignatureLine = (line, method) => {
  const nameMatch = new RegExp(`(^|[^\\w$.])${escapeForRegExp(method.name)}\\s*\\(`).exec(line);
  if (!nameMatch) return false;

  const prefix = line.slice(0, nameMatch.index + nameMatch[1].length);
  if (!SIGNATURE_PREFIX.test(prefix) || EXPRESSION_KEYWORDS.test(prefix)) return false;
  const openAt = nameMatch.index + nameMatch[0].length - 1;
  const closeAt = findEndOfTheParameterList(line, openAt);
  if (closeAt < 0) return false;
  const rest = line.slice(closeAt + 1);
  if (rest.includes(";") || /^\s*[.?]/.test(rest)) return false;

  const parameterTexts = splitAtTopLevelCommas(line.slice(openAt + 1, closeAt)).map(parameterText => parameterText.trim()).filter(Boolean);
  const declaredNames = parameterTexts.map(readDeclaredParameterName);
  const modelNames = (method.parameters || []).map(parameter => parameter.name);
  if (declaredNames.join(",") !== modelNames.join(",")) return false;

  const holdsAType = parameterTexts.some((parameterText, at) => parameterText !== declaredNames[at]);
  return prefix.trim() !== "" || holdsAType || DECLARATION_MARK.test(rest);
};

// A body may start with the signature line of its own method, as the shape model allows, and that line declares the parameters and calls nothing.
const dropTheSignatureLine = method => {
  const lines = method.body.split("\n");
  const firstAt = lines.findIndex(line => line.trim() !== "");
  if (firstAt < 0 || !isTheSignatureLine(lines[firstAt], method)) return method.body;
  return lines.slice(firstAt + 1).join("\n");
};

export const readMethodBodyStatements = method => readBodyStatements(dropTheSignatureLine(method));
