import { stripComment } from "../generic/dependencies/BuildFileText.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

function findGoModLines(lines) {
  const found = [];
  let inBlock = false;
  for (const raw of lines) {
    const text = stripComment(raw, "//");
    if (/^require\s*\($/.test(text)) { inBlock = true; continue; }
    if (inBlock && text === ")") { inBlock = false; continue; }
    if (inBlock && text) found.push(text);
    else if (/^require\s+\S/.test(text)) found.push(text.replace(/^require\s+/, ""));
  }
  return found;
}

export class GoApplicationFinder extends GenericApplicationFinder {
  buildSystem = "go";
  buildFileNames = ["go.mod"];
  buildFileSuffixes = [];
  dependencyFormats = [{ name: /^go\.mod$/, readLines: findGoModLines }];
}
