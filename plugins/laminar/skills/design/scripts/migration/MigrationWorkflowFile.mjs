import path from "node:path";
import { fileURLToPath } from "node:url";
import { readList } from "../model/DesignModel.mjs";
import { writeWorkflowReturnFile } from "../../../review/scripts/files/workflowReturnFile.mjs";
import { listMigrationGroups } from "./MigrationGroups.mjs";
import { SELF_CHECK_JUDGES, estimateSelfCheckCost } from "./SelfCheckCost.mjs";
import { DECIDED_REVIEW_FILE, getPlanFolder, isAnOpenQuestion } from "../plan/PlanFolder.mjs";

export const MIGRATION_WORKFLOW_FILE = "migration.workflow.js";

const DESIGN_FILE = "design.md";

const MIGRATION_RETURN_META = { name: "migration-return", description: "The migration groups of 1 design, for the writer workflow" };

const DESIGN_SCRIPTS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REVIEW_SCRIPTS_FOLDER = path.resolve(DESIGN_SCRIPTS_FOLDER, "../../review/scripts");

const listOpenQuestionIds = model => readList(model.decisions.questions)
  .filter(isAnOpenQuestion)
  .map(question => question.id);

// The writer workflow cannot read a file, so it loads this file as a workflow that returns the migration groups beside the migration.
export const writeMigrationWorkflowFile = (model, steps, { migrationPath, repositoryRoot, defectCount, plan }) => {
  const resultsFolder = path.dirname(migrationPath);
  const workflowFilePath = path.join(resultsFolder, MIGRATION_WORKFLOW_FILE);
  writeWorkflowReturnFile(workflowFilePath, MIGRATION_RETURN_META, {
    design: path.join(resultsFolder, DESIGN_FILE),
    migration: migrationPath,
    repository: repositoryRoot,
    openQuestions: listOpenQuestionIds(model),
    defects: defectCount,
    plan,
    ...(Number.isInteger(plan) ? { decidedReview: path.join(getPlanFolder(resultsFolder, plan), DECIDED_REVIEW_FILE) } : {}),
    reviewScripts: REVIEW_SCRIPTS_FOLDER,
    designScripts: DESIGN_SCRIPTS_FOLDER,
    selfCheckJudges: SELF_CHECK_JUDGES,
    groups: listMigrationGroups(model, steps).map(group => ({ ...group, selfCheckCost: estimateSelfCheckCost(model, steps, group.group) })),
  });
  return workflowFilePath;
};
