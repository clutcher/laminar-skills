import crypto from "node:crypto";
import { isANonBlankCodeLine } from "../../../../../inputs/source/lines/LineKinds.mjs";

export const WINDOW_LINES = 5;
export const MIN_WINDOW_LENGTH = 40;

export const normaliseLine = line => line.trim().replace(/[A-Za-z_$][\w$]*/g, "V").replace(/\s+/g, " ");

const normaliseWindow = lines => lines.map(normaliseLine).join(" ");

export function collectWindows(bodyLines) {
  const code = bodyLines.filter(isANonBlankCodeLine);
  const windows = [];
  for (let start = 0; start + WINDOW_LINES <= code.length; start++) {
    const form = normaliseWindow(code.slice(start, start + WINDOW_LINES));
    if (form.length >= MIN_WINDOW_LENGTH) windows.push({ form, firstLine: code[start].trim() });
  }
  return windows;
}

const FINGERPRINT_LENGTH = 16;

export const createFingerprint = form => crypto.createHash("sha1").update(form).digest("hex").slice(0, FINGERPRINT_LENGTH);

export function fingerprintCodeWindows(numberedLines) {
  const code = numberedLines.filter(({ text }) => isANonBlankCodeLine(text));
  const forms = code.map(({ text }) => normaliseLine(text));
  const windows = [];
  for (let start = 0; start + WINDOW_LINES <= code.length; start++) {
    const form = forms.slice(start, start + WINDOW_LINES).join(" ");
    if (form.length >= MIN_WINDOW_LENGTH) windows.push(`${code[start].line} ${createFingerprint(form)}`);
  }
  return windows;
}
