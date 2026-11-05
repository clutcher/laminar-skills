import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAText, readList } from "../model/DesignModel.mjs";
import { writeWorkflowReturnFile } from "../../../review/scripts/files/workflowReturnFile.mjs";
import { listMigrationGroups } from "./MigrationGroups.mjs";

export const MIGRATION_WORKFLOW_FILE = "migration.workflow.js";

const DESIGN_FILE = "design.md";

const MIGRATION_RETURN_META = { name: "migration-return", description: "The migration groups of 1 design, for the writer workflow" };

const WRITER_BRIEF_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../references/writer.md");

const OPEN_AUTONOMOUS = "open";

const isAnsweredQuestion = question => Boolean(question.answer) && isAText(question.answer.option);

const listOpenQuestionIds = model => readList(model.decisions.questions)
  .filter(question => question.autonomous === OPEN_AUTONOMOUS && !isAnsweredQuestion(question))
  .map(question => question.id);

// The writer workflow cannot read a file, so it loads this file as a workflow that returns the migration groups beside the migration.
export const writeMigrationWorkflowFile = (model, steps, { migrationPath, repositoryRoot, defectCount }) => {
  const resultsFolder = path.dirname(migrationPath);
  const workflowFilePath = path.join(resultsFolder, MIGRATION_WORKFLOW_FILE);
  writeWorkflowReturnFile(workflowFilePath, MIGRATION_RETURN_META, {
    design: path.join(resultsFolder, DESIGN_FILE),
    migration: migrationPath,
    writerBrief: WRITER_BRIEF_PATH,
    repository: repositoryRoot,
    openQuestions: listOpenQuestionIds(model),
    defects: defectCount,
    groups: listMigrationGroups(model, steps),
  });
  return workflowFilePath;
};
