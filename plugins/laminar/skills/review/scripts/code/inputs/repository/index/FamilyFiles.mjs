import { splitTextIntoLines } from "../../source/SourceText.mjs";
import { isMinified } from "../RepositoryFileKinds.mjs";

export class FamilyFiles {
  constructor({ family, files, minified }) {
    Object.assign(this, { family, files, minified });
  }

  static buildFamilyFiles(family, paths, readText) {
    const files = [];
    let minified = 0;
    for (const given of paths) {
      const text = readText(given);
      if (text === null) continue;
      const lines = splitTextIntoLines(text);
      if (isMinified(given, lines)) { minified++; continue; }
      files.push({ path: given, lines });
    }
    return new FamilyFiles({ family, files, minified });
  }

  static createFromSaved(saved) {
    return new FamilyFiles({ ...saved, files: saved.files.map(file => ({ path: file.path, text: file.text })) });
  }

  convertToSaved() {
    return {
      family: this.family,
      minified: this.minified,
      files: this.files.map(file => ({ path: file.path, text: this.readFileLines(file).join("\n") })),
    };
  }

  readFileLines(file) {
    if (!file.lines) { file.lines = file.text.split("\n"); delete file.text; }
    return file.lines;
  }
}
