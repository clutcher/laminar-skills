import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { createDelimitedOpener, createShortQuote } from "../../forms/StringForms.mjs";
import { C_COMMENTS, createForm } from "../../forms/LexicalForms.mjs";
import { BLANK_PATTERN_SOURCE, rejectStatements } from "../../forms/FunctionNamePatterns.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

const OBJECT_KEY_FUNCTION_PATTERN = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s+)?function\b\*?/;

const findObjectKeyFunction = head => {
  const keyFunction = OBJECT_KEY_FUNCTION_PATTERN.exec(head);
  return keyFunction ? { scale: Scale.METHOD.name, name: keyFunction[1], scope: null } : null;
};

const TEST_CALL_PATTERN = /^\s*(?:it|test|specify)(?:\s*\.\s*(?:only|skip|todo|concurrent|failing|sequential|serial))*\s*\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*,/;

const MAX_TEST_NAME_LENGTH = 60;

const CHARACTER_OUTSIDE_A_TEST_NAME_PATTERN = /[^\p{L}\p{N}'\s-]+/gu;

function shortenTestName(description) {
  const words = description.replace(CHARACTER_OUTSIDE_A_TEST_NAME_PATTERN, " ").trim().split(/\s+/).filter(Boolean);
  let name = "";
  for (const word of words) {
    const nameWithTheNextWord = name ? `${name} ${word}` : word;
    if (name && nameWithTheNextWord.length > MAX_TEST_NAME_LENGTH) break;
    name = nameWithTheNextWord;
  }
  return name.slice(0, MAX_TEST_NAME_LENGTH);
}

const findTheTestCallDeclaration = head => {
  const testCallMatch = TEST_CALL_PATTERN.exec(head);
  const name = testCallMatch ? shortenTestName(testCallMatch[2]) : "";
  return name ? { scale: Scale.METHOD.name, name, scope: null, isATestCall: true } : null;
};

const findTestCallOrObjectKeyFunction = head => findTheTestCallDeclaration(head) || findObjectKeyFunction(head);

const templateLiteral = createDelimitedOpener("`", "`", { spansLines: true, escapes: true, expressions: true });

const JAVASCRIPT_FUNCTION_NAME_PATTERN_SOURCE = [
  rejectStatements(),
  `^((export${BLANK_PATTERN_SOURCE}+)?(default${BLANK_PATTERN_SOURCE}+)?(declare${BLANK_PATTERN_SOURCE}+)?(const|let|var)${BLANK_PATTERN_SOURCE}+[A-Za-z_$][A-Za-z0-9_$]*)`,
  `^${BLANK_PATTERN_SOURCE}+((const|let|var)${BLANK_PATTERN_SOURCE}+[A-Za-z_$][A-Za-z0-9_$]*${BLANK_PATTERN_SOURCE}*(:[^=]*)?=${BLANK_PATTERN_SOURCE}*(async${BLANK_PATTERN_SOURCE}*)?` +
    `(function|\\([^)]*\\)${BLANK_PATTERN_SOURCE}*(:[^=]*)?=>|[A-Za-z_$][A-Za-z0-9_$]*${BLANK_PATTERN_SOURCE}*=>).*)`,
  `^${BLANK_PATTERN_SOURCE}*((export${BLANK_PATTERN_SOURCE}+)?(default${BLANK_PATTERN_SOURCE}+)?(declare${BLANK_PATTERN_SOURCE}+)?(abstract${BLANK_PATTERN_SOURCE}+)?(async${BLANK_PATTERN_SOURCE}+)?` +
    `(function\\*?|class|interface|type|enum|namespace|module)${BLANK_PATTERN_SOURCE}+[A-Za-z_$][A-Za-z0-9_$]*.*)`,
  `^${BLANK_PATTERN_SOURCE}*([A-Za-z_$][A-Za-z0-9_$]*${BLANK_PATTERN_SOURCE}*:${BLANK_PATTERN_SOURCE}*(async${BLANK_PATTERN_SOURCE}+)?function\\*?(${BLANK_PATTERN_SOURCE}+[A-Za-z_$][A-Za-z0-9_$]*)?${BLANK_PATTERN_SOURCE}*\\(.*)`,
  `^${BLANK_PATTERN_SOURCE}*(((public|private|protected|static|readonly|async|get|set|override|abstract)${BLANK_PATTERN_SOURCE}+)*` +
    `[A-Za-z_$][A-Za-z0-9_$]*${BLANK_PATTERN_SOURCE}*(<[^>]*>)?${BLANK_PATTERN_SOURCE}*\\((([^;]|\\{[^{}]*\\})*(\\{|\\(|,|=>))?${BLANK_PATTERN_SOURCE}*$)`,
  `^${BLANK_PATTERN_SOURCE}*(((public|private|protected|static|readonly|async|get|set|override|abstract)${BLANK_PATTERN_SOURCE}+)*` +
    `[A-Za-z_$][A-Za-z0-9_$]*${BLANK_PATTERN_SOURCE}*(<[^>]*>)?${BLANK_PATTERN_SOURCE}*\\([^;{}]*\\)${BLANK_PATTERN_SOURCE}*(:[^{;]*)?\\{.*\\}${BLANK_PATTERN_SOURCE}*;?${BLANK_PATTERN_SOURCE}*$)`,
].join("\n");

export const TypeScriptLanguage = Object.freeze({
  diffDriver: "javascript",
  extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"],
  testFileNames: [/\.(?:test|spec)\.[a-z]+$/],
  testNameAffixes: { openings: [], endings: [".test", ".spec"] },
  commentForms: C_FAMILY,
  stringForm: createForm(C_COMMENTS, [templateLiteral, createShortQuote("'"), createShortQuote("\"")]),
  functionNamePattern: JAVASCRIPT_FUNCTION_NAME_PATTERN_SOURCE,
  readDeclaration: findTestCallOrObjectKeyFunction,
  singleQuotedStrings: true,
  backQuotedStrings: true,
  regexLiterals: true,
  openAcrossLines: [{ opens: "`", closes: "`" }],
  trailingDotContinues: true,
  moduleSeparator: "/",
});
