import fs from "node:fs";

const metaBlockOf = meta => [
  "export const meta = {",
  `  name: ${JSON.stringify(meta.name)},`,
  `  description: ${JSON.stringify(meta.description)},`,
  "}",
].join("\n");

export function writeWorkflowReturnFile(filePath, meta, value) {
  fs.writeFileSync(filePath, `${metaBlockOf(meta)}\n\nreturn ${JSON.stringify(value)}\n`);
}
