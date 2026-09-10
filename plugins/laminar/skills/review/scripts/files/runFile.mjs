import fs from "node:fs";

export class RunFileStop extends Error {}

export function readRunFileText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new RunFileStop(`cannot read ${filePath}: ${error.message}`);
  }
}
