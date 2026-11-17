import { MEMBER_LANGUAGES, readClassDeclaration, readMemberLanguage } from "./ClassDeclaration.mjs";

// The words of Java that stand before a return type and are no part of it.
const JAVA_MODIFIERS = new Set(["public", "protected", "private", "static", "final", "abstract", "synchronized", "native", "default", "strictfp", "sealed", "non-sealed"]);

// The words of JavaScript and TypeScript that stand before a method name and are no part of it.
const SCRIPT_MODIFIERS = new Set(["public", "private", "protected", "static", "async", "readonly", "override", "abstract", "declare", "accessor", "*"]);

// A getter or a setter reads like a field to its caller, so the method check leaves it to the field list.
const SCRIPT_ACCESSOR_WORDS = new Set(["get", "set"]);

const HIDING_WORDS = new Set(["private", "protected"]);

const PRIVATE_MARKS = ["#", "_"];

const TYPE_WORDS = /\b(?:class|record|enum|interface)\b/;

const CONSTRUCTOR = "constructor";

const JAVA_INTERFACE = "interface";

const JAVA_ENUM = "enum";

// The name right before the parameters of a head, after an optional list of type parameters and the mark of an optional method.
const NAME_BEFORE_THE_PARAMETERS = /([A-Za-z_$#][\w$]*)\s*(?:<[^()]*>)?\s*\??\s*$/;

// The heads of a class body at its own depth: the text before each block it opens, with the text of that block, and each piece that ends at a semicolon or, in a script, at a line end, where no parenthesis is open, with no block.
const listTopLevelHeads = (bodyText, endsAtLine) => {
  const heads = [];
  let head = null;
  let text = "";
  let depth = 0;
  let openParentheses = 0;
  for (const character of bodyText) {
    if (depth === 0 && character === "(") openParentheses += 1;
    else if (depth === 0 && character === ")") openParentheses = Math.max(0, openParentheses - 1);
    else if (openParentheses === 0 && character === "{") {
      if (depth === 0) {
        head = { text: text.trim(), blockText: "" };
        heads.push(head);
        text = "";
      } else head.blockText += character;
      depth += 1;
      continue;
    } else if (openParentheses === 0 && character === "}") {
      depth = Math.max(0, depth - 1);
      if (depth > 0) head.blockText += character;
      continue;
    } else if (depth === 0 && openParentheses === 0 && (character === ";" || (endsAtLine && character === "\n"))) {
      heads.push({ text: text.trim(), blockText: null });
      text = "";
      continue;
    }
    if (depth === 0) text += character;
    else head.blockText += character;
  }
  heads.push({ text: text.trim(), blockText: null });
  return heads.filter(head => head.text);
};

// The name of the method a head declares and the words before that name; null where the head declares no method, such as a field with a value, a nested type or a block.
const readMethodHead = head => {
  const open = head.indexOf("(");
  if (open < 0) return null;

  const prefix = head.slice(0, open);
  if (prefix.includes("=") || TYPE_WORDS.test(prefix)) return null;
  const name = NAME_BEFORE_THE_PARAMETERS.exec(prefix);
  if (!name) return null;
  return { name: name[1], words: prefix.slice(0, name.index).split(/\s+/).filter(Boolean) };
};

const readJavaPublicMethodName = (methodHead, declaration, simpleName) => {
  const returnTypeWords = methodHead.words.filter(word => !JAVA_MODIFIERS.has(word) && !word.startsWith("<"));
  if (!returnTypeWords.length || methodHead.name === simpleName) return null;

  const isPublic = methodHead.words.includes("public") || (declaration.kindWord === JAVA_INTERFACE && !methodHead.words.includes("private"));
  return isPublic ? methodHead.name : null;
};

const readScriptPublicMethodName = methodHead => {
  if (methodHead.name === CONSTRUCTOR || PRIVATE_MARKS.some(mark => methodHead.name.startsWith(mark))) return null;
  if (!methodHead.words.every(word => SCRIPT_MODIFIERS.has(word) || SCRIPT_ACCESSOR_WORDS.has(word))) return null;
  if (methodHead.words.some(word => SCRIPT_ACCESSOR_WORDS.has(word) || HIDING_WORDS.has(word))) return null;
  return methodHead.name;
};

// The body text whose heads declare methods: an enum of Java declares its constants before the first semicolon, and a constant with a body is no method.
const readMethodBodyText = (declaration, language) => {
  if (language !== MEMBER_LANGUAGES.JAVA || declaration.kindWord !== JAVA_ENUM) return declaration.bodyText;
  const constantsEnd = declaration.bodyText.indexOf(";");
  return constantsEnd < 0 ? "" : declaration.bodyText.slice(constantsEnd + 1);
};

// The public methods a Java, JavaScript or TypeScript file declares for 1 class, read from its text, the methods of its nested types left out; null where the file is in another language or declares no such class.
export const readDeclaredPublicMethodNames = (text, file, className) => {
  const language = readMemberLanguage(file);
  if (!language) return null;

  const declaration = readClassDeclaration(text, className);
  if (!declaration) return null;
  const simpleName = className.split(".").pop();
  const methodNames = listTopLevelHeads(readMethodBodyText(declaration, language), language === MEMBER_LANGUAGES.SCRIPT)
    .map(head => readMethodHead(head.text))
    .filter(Boolean)
    .map(methodHead => (language === MEMBER_LANGUAGES.JAVA ? readJavaPublicMethodName(methodHead, declaration, simpleName) : readScriptPublicMethodName(methodHead)))
    .filter(Boolean);
  return new Set(methodNames);
};

// A head with no block declares a method with no body only in an interface or with the word abstract; elsewhere it can be a native method, an overload signature or a script head whose brace stands on the next line.
const isBodilessHead = (methodHead, head, declaration) => head.blockText === null && (declaration.kindWord === JAVA_INTERFACE || methodHead.words.includes("abstract"));

// Each method a Java, JavaScript or TypeScript file declares for 1 class at its own depth, with whether its declaration has no body and the text of its body, the methods of its nested types left out; null where the file is in another language or declares no such class.
export const listDeclaredMethods = (text, file, className) => {
  const language = readMemberLanguage(file);
  if (!language) return null;

  const declaration = readClassDeclaration(text, className);
  if (!declaration) return null;
  return listTopLevelHeads(readMethodBodyText(declaration, language), language === MEMBER_LANGUAGES.SCRIPT).flatMap(head => {
    const methodHead = readMethodHead(head.text);
    if (!methodHead) return [];
    return [{ name: methodHead.name, isBodiless: isBodilessHead(methodHead, head, declaration), bodyText: head.blockText || "" }];
  });
};
