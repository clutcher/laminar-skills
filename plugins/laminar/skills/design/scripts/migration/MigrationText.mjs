const EXISTING_DEFECT_LABEL = "existing defect of the modified class";

const writeGroupHeading = step => `## Migration group ${step.group}${step.existingDefect ? `: ${EXISTING_DEFECT_LABEL}` : ""}`;

const writeOrderDefectLines = orderDefects => (orderDefects.length
  ? ["", "## Defects of the order", "", ...orderDefects.map(defect => `- ${defect.code}: ${defect.sentence}`)]
  : []);

export const writeMigrationText = (steps, currentTreeLine, orderDefects = []) => {
  const lines = ["# Migration", "", currentTreeLine, ...writeOrderDefectLines(orderDefects)];
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
