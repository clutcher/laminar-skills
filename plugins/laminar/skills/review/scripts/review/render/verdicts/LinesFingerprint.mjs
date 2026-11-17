import crypto from "node:crypto";
import path from "node:path";
import { parseOwnLinesOfTheSlice } from "../../prepare/formats/SliceFormat.mjs";
import { REVIEW_ABSTRACTIONS_FILE } from "../../prepare/PrepareStep.mjs";
import { readJsonFileIfPresent } from "../../../files/jsonFile.mjs";

const PREPARE_FILE = "prepare.json";

const LINES_FINGERPRINT_LENGTH = 12;

// The own simple name stands as this mark, so a rename alone leaves the lines fingerprint as it was.
const OWN_NAME_MARK = "<own name>";

const escapeForAPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const maskTheOwnName = (text, simpleName) => (simpleName
  ? text.replace(new RegExp(`(?<![A-Za-z0-9_$])${escapeForAPattern(simpleName)}(?![A-Za-z0-9_$])`, "g"), OWN_NAME_MARK)
  : text);

const normalizeTheOwnLine = text => text.replace(/\s+/g, " ").trim();

// Only own lines that run from the first line of the span to its last, 1 per line, are the lines of the abstraction: reference lines, hunk lines and the lines of a field group are not.
const isWhole = (ownLines, span) => Boolean(span)
  && ownLines.length === span.to - span.from + 1
  && ownLines.every((ownLine, offset) => ownLine.line === span.from + offset);

// The state of the lines of 1 abstraction of a run folder, an entry of the code under review or an abstraction of the tree; "" where its own lines are not whole.
export const computeLinesFingerprint = abstraction => {
  const ownLines = parseOwnLinesOfTheSlice(abstraction);
  if (!ownLines.length || !isWhole(ownLines, abstraction.lines)) return "";

  const simpleName = String(abstraction.name || "");
  const texts = ownLines.map(ownLine => normalizeTheOwnLine(ownLine.text)).filter(Boolean).map(text => maskTheOwnName(text, simpleName));
  return crypto.createHash("sha256").update(texts.join("\n")).digest("hex").slice(0, LINES_FINGERPRINT_LENGTH);
};

const listTheTree = abstractions => abstractions.flatMap(abstraction => [abstraction, ...listTheTree(abstraction.children || [])]);

const isTheAbstraction = (abstraction, displayNames, scale, file) => displayNames.includes(abstraction.displayName)
  && String(abstraction.scale || "").toLowerCase() === scale
  && (!file || abstraction.path === file);

// The abstractions of 1 run folder that a lines fingerprint is read from: the code under review of prepare.json first, then the tree of review-abstractions.json, which a stored copy of a run folder may lack.
export class LinesFingerprintsOfTheRun {
  constructor(prepared, reviewed) {
    this.abstractions = [...((prepared || {}).codeUnderReview || []), ...listTheTree((reviewed || {}).abstractions || [])];
  }

  static readFrom(runFolder) {
    return new LinesFingerprintsOfTheRun(readJsonFileIfPresent(path.join(runFolder, PREPARE_FILE), null), readJsonFileIfPresent(path.join(runFolder, REVIEW_ABSTRACTIONS_FILE), null));
  }

  findLinesFingerprint(displayNames, scale, file) {
    for (const abstraction of this.abstractions.filter(given => isTheAbstraction(given, displayNames, scale, file))) {
      const linesFingerprint = computeLinesFingerprint(abstraction);
      if (linesFingerprint) return linesFingerprint;
    }
    return "";
  }
}
