import fs from "node:fs";
import path from "node:path";
import { AUTONOMOUS_ANSWERS } from "../model/DesignModelForm.mjs";
import { isAText, readList } from "../model/DesignModel.mjs";

export const BASE_COMMIT_FILE = "base-commit.txt";

export const PLAN_COMMIT_FILE = "plan-commit.txt";

export const MODEL_FILE = "design-model.json";

export const FINDINGS_FILE = "findings.json";

export const DISPOSITIONS_FILE = "dispositions.json";

export const OUTCOME_FILE = "outcome.json";

const PLANS_FOLDER = "plans";

const PLAN_FOLDER_NAME = /^[1-9]\d*$/;

export const PLAN_OUTCOMES = Object.freeze({ READY: "ready", QUESTION: "question", STOP: "stop" });

export const getPlansFolder = resultsFolder => path.join(resultsFolder, PLANS_FOLDER);

export const getPlanFolder = (resultsFolder, plan) => path.join(getPlansFolder(resultsFolder), String(plan));

// The highest numbered folder under plans/, or 0 where no plan was written yet.
export const findLastPlan = resultsFolder => {
  const plansFolder = getPlansFolder(resultsFolder);
  if (!fs.existsSync(plansFolder)) return 0;
  const plans = fs.readdirSync(plansFolder).filter(name => PLAN_FOLDER_NAME.test(name)).map(Number);
  return plans.length ? Math.max(...plans) : 0;
};

export const writeJson = (filePath, value) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

export const copyFileIfPresent = (fromPath, toFolder) => {
  if (fs.existsSync(fromPath)) fs.copyFileSync(fromPath, path.join(toFolder, path.basename(fromPath)));
};

// A question stops the plan where it holds no answer and its autonomous answer is not open, because an open question only keeps the writers off its boundary.
export const listQuestionsThatStopThePlan = model => readList(model.decisions.questions)
  .filter(question => !(question.answer && isAText(question.answer.option)) && question.autonomous !== AUTONOMOUS_ANSWERS.OPEN)
  .map(question => question.id);

export const writeOutcome = (resultsFolder, plan, outcome) => {
  const planFolder = getPlanFolder(resultsFolder, plan);
  fs.mkdirSync(planFolder, { recursive: true });
  writeJson(path.join(planFolder, OUTCOME_FILE), { plan, outcome: outcome.word, questions: outcome.questions || [], stop: outcome.stop || null });
};

export const formatPlanLine = (plan, outcomeWord, resultsFolder) => `plan ${plan} ${outcomeWord} ${resultsFolder}`;
