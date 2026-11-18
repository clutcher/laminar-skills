import fs from "node:fs";
import path from "node:path";

export const FINDING_FALSE = "finding-false";

const LINE_BREAK = /\r?\n/;

// A path that leaves the repository through .. or lies on another drive is outside it.
const isInsideTheFolder = (folder, filePath) => {
  const relativePath = path.relative(folder, filePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
};

const findWhyTheFormIsRefused = (answer, evidence) => {
  if (!String(answer.says || "").trim()) return "says gives no reason why the claim of the finding does not hold";
  if (!evidence || typeof evidence !== "object") return "the answer gives no evidence";
  if (!String(evidence.file || "").trim()) return "the evidence names no file";
  if (evidence.line == null && !String(evidence.quote || "").trim()) return "the evidence names no line and quotes no line";
  return "";
};

// A relative file stands in the repository; an absolute file stands in it or is an input of the writer, such as design.md or a review.md.
const resolveEvidenceFile = (file, tree) => (path.isAbsolute(file) ? path.resolve(file) : path.resolve(tree.repository, file));

const findWhyTheFileIsRefused = (file, filePath, tree) => {
  if (!tree.inputs.includes(filePath) && !isInsideTheFolder(tree.repository, filePath)) return `the evidence file ${file} is outside the repository and the inputs of the writer`;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return `the evidence file ${file} is not in the tree`;
  return "";
};

const findWhyTheLineIsRefused = (evidence, lines) => {
  if (evidence.line == null) return "";
  if (!Number.isInteger(evidence.line) || evidence.line < 1 || evidence.line > lines.length) return `line ${evidence.line} is not in ${evidence.file}, which has ${lines.length} lines`;
  return "";
};

const findWhyTheQuoteIsRefused = (evidence, lines) => {
  const quote = String(evidence.quote || "").trim();
  if (!quote) return "";
  if (evidence.line != null) return lines[evidence.line - 1].includes(quote) ? "" : `the quote does not stand at line ${evidence.line} of ${evidence.file}`;
  return lines.some(line => line.includes(quote)) ? "" : `the quote does not stand in ${evidence.file}`;
};

// The empty text where the evidence of 1 finding-false answer stands in the tree, else why it is refused.
const findWhyRefused = (answer, tree) => {
  const evidence = answer.evidence;
  const formRefused = findWhyTheFormIsRefused(answer, evidence);
  if (formRefused) return formRefused;

  const filePath = resolveEvidenceFile(evidence.file, tree);
  const fileRefused = findWhyTheFileIsRefused(evidence.file, filePath, tree);
  if (fileRefused) return fileRefused;

  const lines = fs.readFileSync(filePath, "utf8").split(LINE_BREAK);
  return findWhyTheLineIsRefused(evidence, lines) || findWhyTheQuoteIsRefused(evidence, lines);
};

// tree: the repository root and the absolute paths of the inputs of the writer.
export const listRefusedAnswers = (answers, tree) => {
  const resolvedTree = { repository: path.resolve(tree.repository), inputs: (tree.inputs || []).map(input => path.resolve(input)) };
  const refusedAnswers = [];
  for (const answer of answers.filter(given => given.reason === FINDING_FALSE)) {
    const why = findWhyRefused(answer, resolvedTree);
    if (why) refusedAnswers.push({ number: answer.number, why });
  }
  return refusedAnswers;
};
