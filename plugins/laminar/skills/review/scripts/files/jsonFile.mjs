import fs from "node:fs";
import { readRunFileText, RunFileStop } from "./runFile.mjs";

const INDENT = " ";
const FLUSH_LENGTH = 1 << 20;

class BufferedFileWriter {
  constructor(descriptor) {
    this.descriptor = descriptor;
    this.pending = [];
    this.length = 0;
  }

  push(text) {
    this.pending.push(text);
    this.length += text.length;
    if (this.length >= FLUSH_LENGTH) this.flush();
  }

  flush() {
    if (this.pending.length) fs.writeSync(this.descriptor, this.pending.join(""));
    this.pending = [];
    this.length = 0;
  }
}

const isLeftOut = value => value === undefined || typeof value === "function" || typeof value === "symbol";

const convertToJsonValue = (value, key) => (value !== null && typeof value === "object" && typeof value.toJSON === "function" ? value.toJSON(key) : value);

const isAContainer = value => value !== null && typeof value === "object";

function pushArray(chunks, array, depth) {
  if (!array.length) { chunks.push("[]"); return; }
  const inner = INDENT.repeat(depth + 1);
  chunks.push("[");
  array.forEach((element, index) => {
    const value = convertToJsonValue(element, String(index));
    chunks.push(`${index ? "," : ""}\n${inner}`);
    if (isLeftOut(value)) chunks.push("null");
    else pushValue(chunks, value, depth + 1);
  });
  chunks.push(`\n${INDENT.repeat(depth)}]`);
}

function pushObject(chunks, object, depth) {
  const keptPairs = Object.keys(object)
    .map(key => [key, convertToJsonValue(object[key], key)])
    .filter(([, value]) => !isLeftOut(value));
  if (!keptPairs.length) { chunks.push("{}"); return; }
  const inner = INDENT.repeat(depth + 1);
  chunks.push("{");
  keptPairs.forEach(([key, value], index) => {
    chunks.push(`${index ? "," : ""}\n${inner}${JSON.stringify(key)}: `);
    pushValue(chunks, value, depth + 1);
  });
  chunks.push(`\n${INDENT.repeat(depth)}}`);
}

function pushValue(chunks, value, depth) {
  if (!isAContainer(value)) { chunks.push(JSON.stringify(value)); return; }
  if (Array.isArray(value)) pushArray(chunks, value, depth);
  else pushObject(chunks, value, depth);
}

export function readJsonFile(filePath) {
  const text = readRunFileText(filePath);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new RunFileStop(`cannot parse ${filePath} as JSON: ${error.message}`);
  }
}

export const createPropertyWhenNotEmpty = (key, list) => (list.length ? { [key]: list } : {});

export const readJsonFileIfPresent = (filePath, absent) => (fs.existsSync(filePath) ? readJsonFile(filePath) : absent);

export function writeJsonFile(filePath, value) {
  const descriptor = fs.openSync(filePath, "w");
  try {
    const chunks = new BufferedFileWriter(descriptor);
    pushValue(chunks, convertToJsonValue(value, ""), 0);
    chunks.flush();
  } finally {
    fs.closeSync(descriptor);
  }
}
