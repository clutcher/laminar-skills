const EXISTING_DEFECT_LABEL = "existing defect of the modified class";

const writeGroupHeading = step => `## Migration group ${step.group}${step.existingDefect ? `: ${EXISTING_DEFECT_LABEL}` : ""}`;

const writeDefectLines = (heading, defects) => (defects.length
  ? ["", heading, "", ...defects.map(defect => `- ${defect.code}: ${defect.sentence}`)]
  : []);

export const NO_STEP_HEADING = "## Findings with no step";

export const formatNoStepLine = line => `finding ${line.number}: ${line.check} on ${line.displayName}: ${line.why}`;

// The findings of the run folder that got no step, last in the file, so no finding is dropped in silence.
const writeNoStepLines = noStepLines => (noStepLines.length
  ? ["", NO_STEP_HEADING, "", ...noStepLines.map(line => `- ${formatNoStepLine(line)}`)]
  : []);

export const writeMigrationText = (steps, currentTreeLine, orderDefects = [], cut = { line: "", defects: [] }, noStepLines = []) => {
  const lines = ["# Migration", "", ...(cut.line ? [cut.line, ""] : []), currentTreeLine, ...writeDefectLines("## Defects of the plan", cut.defects), ...writeDefectLines("## Defects of the order", orderDefects)];
  let group = null;
  for (const step of steps) {
    if (step.group !== group) {
      group = step.group;
      lines.push("", writeGroupHeading(step), "");
    }
    lines.push(`${step.number}. [${step.stage}] ${step.says}`);
    lines.push(`   - Files: ${step.files.map(file => `\`${file}\``).join(", ")}`);
  }
  lines.push(...writeNoStepLines(noStepLines));
  return `${lines.join("\n")}\n`;
};
