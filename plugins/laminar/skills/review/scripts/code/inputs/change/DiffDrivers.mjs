import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CUSTOM_PATTERN_BY_DIFF_DRIVER_MAP, DIFF_DRIVER_BY_EXTENSION_MAP } from "../source/Languages.mjs";
import { runGitProcess } from "../repository/GitCommands.mjs";

export const formatDiffAttributeLines = () =>
  Object.entries(DIFF_DRIVER_BY_EXTENSION_MAP).map(([extension, diffDriver]) => `*${extension} diff=${diffDriver}\n`).join("");

export function formatDiffConfigLines() {
  const quoteValue = value => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
  return Object.entries(CUSTOM_PATTERN_BY_DIFF_DRIVER_MAP)
    .map(([diffDriver, pattern]) => `[diff "${diffDriver}"]\n\txfuncname = ${quoteValue(pattern)}\n`).join("");
}

function writeTemporaryFile(prefix, contents) {
  const written = path.join(os.tmpdir(), `${prefix}-${process.pid}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(written, contents);
  return written;
}

export function runWithDiffDrivers(work) {
  const attributes = writeTemporaryFile("laminar-attributes", formatDiffAttributeLines());
  const config = writeTemporaryFile("laminar-config", formatDiffConfigLines());
  try {
    return work(["-c", `core.attributesFile=${attributes}`, "-c", `include.path=${config}`]);
  } finally {
    fs.unlinkSync(attributes);
    fs.unlinkSync(config);
  }
}

const NO_DIFF = null;

const isADiffRun = finished => !finished.error && (finished.status === 0 || finished.status === 1);

export function runNoIndexDiff(prefix, writeBeforeAndAfter, diffArgs) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    fs.mkdirSync(path.join(directory, "before"));
    fs.mkdirSync(path.join(directory, "after"));
    writeBeforeAndAfter(path.join(directory, "before"), path.join(directory, "after"));
    const finished = runWithDiffDrivers(driverArgs => runGitProcess([...driverArgs, "diff", "--no-index", ...diffArgs, "--no-color", "--no-renames", "before", "after"], directory));
    return isADiffRun(finished) ? finished.stdout : NO_DIFF;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
