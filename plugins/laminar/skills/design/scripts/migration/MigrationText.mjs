const EXISTING_DEFECT_LABEL = "existing defect of the modified class";

const writeGroupHeading = step => `## Migration group ${step.group}${step.existingDefect ? `: ${EXISTING_DEFECT_LABEL}` : ""}`;

const writeDefectLines = (heading, defects) => (defects.length
  ? ["", heading, "", ...defects.map(defect => `- ${defect.code}: ${defect.sentence}`)]
  : []);

export const writeMigrationText = (steps, currentTreeLine, orderDefects = [], round = { line: "", defects: [] }) => {
  const lines = ["# Migration", "", ...(round.line ? [round.line, ""] : []), currentTreeLine, ...writeDefectLines("## Defects of the round", round.defects), ...writeDefectLines("## Defects of the order", orderDefects)];
  let group = null;
  for (const step of steps) {
    if (step.group !== group) {
      group = step.group;
      lines.push("", writeGroupHeading(step), "");
    }
    lines.push(`${step.number}. [${step.stage}] ${step.says}`);
    lines.push(`   - Files: ${step.files.map(file => `\`${file}\``).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
};
