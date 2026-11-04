// The type declarations of Java, Kotlin, Scala, C#, TypeScript, Python, Rust, Swift and Go: a keyword before a capitalized name, or Go and TypeScript `type X struct`, `type X interface` and `type X =`.
const DECLARED_TYPE = /\b(?:class|interface|record|enum|object|struct|trait)\s+([A-Z][\w$]*)|\btype\s+([A-Z][\w$]*)\s*(?:=|<|struct\b|interface\b)/g;

// The words and marks that carry a declaration head onto its next line in Java, Kotlin, Scala, C# and TypeScript: a supertype list, a type bound, or the opening brace on a line of its own.
const HEAD_GOES_ON = /^(?:[{:,(<&]|extends\b|implements\b|where\b|permits\b|with\b|by\b)/;

const HEAD_LINE_GOES_ON = /[,:(<&]$/;

const PRIVATE_WORD = /\bprivate\b/;

const EXPORT_WORD = /\bexport\b/;

const readLineStart = (text, at) => text.lastIndexOf("\n", at - 1) + 1;

const findClosingBrace = (text, openAt) => {
  let depth = 0;
  for (let at = openAt; at < text.length; at += 1) {
    if (text[at] === "{") depth += 1;
    if (text[at] === "}") depth -= 1;
    if (depth === 0) return at;
  }
  return text.length;
};

const continuesTheHead = (text, newlineAt) => {
  const lineBefore = text.slice(readLineStart(text, newlineAt), newlineAt).trim();
  const textAfter = text.slice(newlineAt + 1).trimStart();
  return HEAD_LINE_GOES_ON.test(lineBefore) || HEAD_GOES_ON.test(textAfter);
};

// The body of a declaration runs from the first brace after its head to the brace that closes it; a head that ends with no brace, such as a Kotlin data class with no members, has no body.
const findBodySpan = (text, headEnd) => {
  let parenthesisDepth = 0;
  for (let at = headEnd; at < text.length; at += 1) {
    const character = text[at];
    if (character === "(") parenthesisDepth += 1;
    else if (character === ")") parenthesisDepth -= 1;
    else if (parenthesisDepth > 0) continue;
    else if (character === "{") return { start: at, end: findClosingBrace(text, at) };
    else if (character === ";" || character === "=" || character === "}") return null;
    else if (character === "\n" && !continuesTheHead(text, at)) return null;
  }
  return null;
};

const findInnermostOuterType = (declaredTypes, at) => declaredTypes
  .filter(declaredType => declaredType.body && declaredType.body.start < at && at < declaredType.body.end)
  .reduce((innermost, declaredType) => (!innermost || declaredType.body.start > innermost.body.start ? declaredType : innermost), null);

// Each declared type with its full dotted name, Outer.Inner for a type declared inside another, so a nested type is compared with the model by the name the model gives it.
export const readDeclaredTypes = codeText => {
  const declaredTypes = [];
  for (const match of codeText.matchAll(DECLARED_TYPE)) {
    const outerType = findInnermostOuterType(declaredTypes, match.index);
    const name = match[1] || match[2];
    const headText = codeText.slice(readLineStart(codeText, match.index), match.index);
    declaredTypes.push({
      name: outerType ? `${outerType.name}.${name}` : name,
      at: match.index,
      outerType,
      isPrivate: PRIVATE_WORD.test(headText),
      isExported: EXPORT_WORD.test(headText),
      body: findBodySpan(codeText, match.index + match[0].length),
    });
  }
  return declaredTypes;
};

export const isInsideTheBody = (declaredType, at) => Boolean(declaredType.body) && declaredType.body.start < at && at < declaredType.body.end;
