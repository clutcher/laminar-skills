import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONVENTIONS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills/code-style/conventions");
const MARKER_ROOT = path.join(os.tmpdir(), "laminar-convention-hints");
const OPT_OUT_VARIABLE = "LAMINAR_CONVENTION_HINTS";
const OPT_OUT_VALUES = new Set(["off", "0", "false"]);
const WRITING_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const MAIN_AGENT = "main";
const CODE_STYLE_SKILL = "laminar:code-style";
const REMINDER_TOOLS = new Set(["Write", "Edit", "MultiEdit", "Bash"]);
const CODE_STYLE_LOADED_MARKER = "code-style-loaded";
const CODE_STYLE_REMINDED_MARKER = "code-style-reminded";

const CONVENTIONS = [
  { name: "java", kind: "language", extensions: [".java"] },
  { name: "typescript", kind: "language", extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] },
  { name: "python", kind: "language", extensions: [".py"] },
  { name: "docs", kind: "language", extensions: [".md", ".mdx"] },
  { name: "spring", kind: "framework", extensions: [".java"], textMark: "springframework" },
];

const REMINDER_LINE = "Load the laminar:code-style skill before you write or change code in this session, and write code with the Write and Edit tools rather than shell commands, so the Laminar conventions of each language reach you.";

const LEAD_LINE = "Laminar conventions for the file you wrote follow. Load the laminar:code-style skill where it is not loaded yet. The project's own conventions under .claude/rules/conventions/ take precedence over these where they conflict.";

const isOptedOut = () => OPT_OUT_VALUES.has(String(process.env[OPT_OUT_VARIABLE] ?? "").trim().toLowerCase());

const readHookInput = () => JSON.parse(fs.readFileSync(0, "utf8"));

const safeFolderName = text => String(text).replace(/[^A-Za-z0-9_-]/g, "_");

const sessionMarkerFolder = hookInput => path.join(MARKER_ROOT, safeFolderName(hookInput.session_id));

const agentMarkerFolder = hookInput => path.join(sessionMarkerFolder(hookInput), safeFolderName(hookInput.agent_id ?? MAIN_AGENT));

function readFileTextIfPresent(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function writtenText(toolInput) {
  const editedTexts = (toolInput.edits ?? []).map(edit => edit.new_string ?? "");
  return [readFileTextIfPresent(toolInput.file_path), toolInput.content ?? "", toolInput.new_string ?? "", ...editedTexts].join("\n");
}

const matchesExtension = (convention, filePath) => convention.extensions.includes(path.extname(filePath).toLowerCase());

const matchesText = (convention, toolInput) => !convention.textMark || writtenText(toolInput).includes(convention.textMark);

const conventionsForWrite = (kind, toolInput) =>
  CONVENTIONS.filter(convention => convention.kind === kind && matchesExtension(convention, toolInput.file_path) && matchesText(convention, toolInput));

function claimMarker(hookInput, markerName) {
  const folder = agentMarkerFolder(hookInput);
  fs.mkdirSync(folder, { recursive: true });
  try {
    fs.writeFileSync(path.join(folder, markerName), "", { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

const conventionText = convention => fs.readFileSync(path.join(CONVENTIONS_FOLDER, `${convention.name}.md`), "utf8");

const isAWriteOfAFile = hookInput => WRITING_TOOLS.has(hookInput.tool_name) && typeof hookInput.tool_input?.file_path === "string";

function hintFor(kind, hookInput) {
  if (!isAWriteOfAFile(hookInput) || !hookInput.session_id) return "";
  const texts = conventionsForWrite(kind, hookInput.tool_input)
    .filter(convention => claimMarker(hookInput, convention.name))
    .map(conventionText);
  return texts.length ? [LEAD_LINE, ...texts].join("\n\n") : "";
}

function showHint(kind, hookInput) {
  const additionalContext = hintFor(kind, hookInput);
  if (!additionalContext) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext } }));
}

const hasMarker = (hookInput, markerName) => fs.existsSync(path.join(agentMarkerFolder(hookInput), markerName));

const isALoadOfCodeStyle = hookInput =>
  hookInput.tool_input?.skill === CODE_STYLE_SKILL || (hookInput.hook_event_name === "UserPromptExpansion" && JSON.stringify(hookInput).includes(CODE_STYLE_SKILL));

function recordCodeStyleLoad(hookInput) {
  if (hookInput.session_id && isALoadOfCodeStyle(hookInput)) claimMarker(hookInput, CODE_STYLE_LOADED_MARKER);
}

function showCodeStyleReminder(hookInput) {
  if (!hookInput.session_id || !REMINDER_TOOLS.has(hookInput.tool_name)) return;
  if (hasMarker(hookInput, CODE_STYLE_LOADED_MARKER) || !claimMarker(hookInput, CODE_STYLE_REMINDED_MARKER)) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: REMINDER_LINE } }));
}

function forgetShownHints(hookInput) {
  if (hookInput.session_id) fs.rmSync(sessionMarkerFolder(hookInput), { recursive: true, force: true });
}

function runHook(mode) {
  if (isOptedOut()) return;
  const hookInput = readHookInput();
  if (mode === "forget") forgetShownHints(hookInput);
  else if (mode === "remind") showCodeStyleReminder(hookInput);
  else if (mode === "loaded") recordCodeStyleLoad(hookInput);
  else showHint(mode, hookInput);
}

try {
  runHook(process.argv[2]);
} catch {
  process.exitCode = 0;
}
