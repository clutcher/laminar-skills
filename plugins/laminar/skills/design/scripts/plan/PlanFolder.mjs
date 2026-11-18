import fs from "node:fs";
import path from "node:path";
import { AUTONOMOUS_ANSWERS } from "../model/DesignModelForm.mjs";
import { isAText, isWaitingAfterTheCeiling, readList } from "../model/DesignModel.mjs";
import { readChecksOfTheFinding } from "./DecidedList.mjs";
import { PREPARE_FILE, REVIEW_FILE, RoundStop, readRunFolder } from "../round/RunFolder.mjs";

export const BASE_COMMIT_FILE = "base-commit.txt";

export const PLAN_COMMIT_FILE = "plan-commit.txt";

export const MODEL_FILE = "design-model.json";

export const FINDINGS_FILE = "findings.json";

export const DISPOSITIONS_FILE = "dispositions.json";

export const OUTCOME_FILE = "outcome.json";

export const SELF_CHECK_FILE = "self-check.json";

export const DECIDED_REVIEW_FILE = "decided-review.json";

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

const isAnsweredQuestion = question => Boolean(question.answer) && isAText(question.answer.option);

// An open question holds no answer and its autonomous answer is open, so the plan goes on and the writers stay off its boundary.
export const isAnOpenQuestion = question => question.autonomous === AUTONOMOUS_ANSWERS.OPEN && !isAnsweredQuestion(question);

// A question stops the plan where it holds no answer and its autonomous answer is not open, because an open question only keeps the writers off its boundary.
export const listQuestionsThatStopThePlan = model => readList(model.decisions.questions)
  .filter(question => !isAnsweredQuestion(question) && question.autonomous !== AUTONOMOUS_ANSWERS.OPEN)
  .map(question => question.id);

const SHAPE_RUNS_FOLDER = "shape-runs";

const SHAPE_RUN_FOLDER_NAME = /^[1-9]\d*$/;

export const getShapeRunFolder = (resultsFolder, run) => path.join(resultsFolder, SHAPE_RUNS_FOLDER, String(run));

export const SHAPE_RUN_NOT_JUDGED = "shape-run-not-judged";

const isPreparedAndNotJudged = shapeRunFolder => fs.existsSync(path.join(shapeRunFolder, PREPARE_FILE)) && !fs.existsSync(path.join(shapeRunFolder, REVIEW_FILE));

// A shape run whose folder holds prepare.json and no review.md was prepared and never judged, because the render writes review.md also on a run that keeps nothing; the numbers in order.
export const listShapeRunsNotJudged = resultsFolder => {
  const shapeRunsFolder = path.join(resultsFolder, SHAPE_RUNS_FOLDER);
  if (!fs.existsSync(shapeRunsFolder)) return [];
  return fs.readdirSync(shapeRunsFolder)
    .filter(name => SHAPE_RUN_FOLDER_NAME.test(name))
    .map(Number)
    .filter(run => isPreparedAndNotJudged(getShapeRunFolder(resultsFolder, run)))
    .sort((first, second) => first - second);
};

export const describeTheShapeRunNotJudged = (resultsFolder, run) => `${getShapeRunFolder(resultsFolder, run)} holds ${PREPARE_FILE} and no ${REVIEW_FILE}, so no judge workflow, merge and render ran on it, and a plan whose tree no shape judge read is not ready`;

// The first finding of 1 item of a shape run, on the check of the object where it names one, read from the run folder of that shape run; null where the folder cannot be read or holds no such item.
const findFindingOfTheShapeItem = (resultsFolder, findingObject) => {
  try {
    const run = readRunFolder(getShapeRunFolder(resultsFolder, findingObject.run), false);
    const item = run.items.find(other => other.number === findingObject.number);
    return item ? item.findings.find(finding => !isAText(findingObject.check) || readChecksOfTheFinding(finding).includes(findingObject.check)) || null : null;
  } catch (error) {
    if (!(error instanceof RoundStop)) throw error;
    return null;
  }
};

// A shape-run finding open after the ceiling with no decided reason stops the plan as a question does, because no writer writes a change that no shape check judged; each object names the item, its display name and check as the decided list keys a finding, taken from the shape run where the object names none, and the change the designer would make.
export const listFindingsThatStopThePlan = (model, resultsFolder) => readList(model.decisions.findings)
  .filter(isWaitingAfterTheCeiling)
  .map(finding => {
    const fromTheShapeRun = findFindingOfTheShapeItem(resultsFolder, finding);
    return {
      run: finding.run,
      number: finding.number,
      displayName: fromTheShapeRun ? fromTheShapeRun.displayName : null,
      check: isAText(finding.check) ? finding.check : (fromTheShapeRun ? fromTheShapeRun.check : null),
      openAfterCeiling: finding.openAfterCeiling,
    };
  });

// decidedKeysNotRaised and decidedThroughInterfaceMethod stand only where the finish read a decided list with no run folder: the decided keys that no shape run raised, and the items of a shape run that a decided key on an api or spi method decides on the method that implements it.
export const writeOutcome = (resultsFolder, plan, outcome) => {
  const planFolder = getPlanFolder(resultsFolder, plan);
  fs.mkdirSync(planFolder, { recursive: true });
  writeJson(path.join(planFolder, OUTCOME_FILE), {
    plan,
    outcome: outcome.word,
    questions: outcome.questions || [],
    considerations: outcome.considerations || [],
    openAfterCeiling: outcome.openAfterCeiling || [],
    doesNotClose: outcome.doesNotClose || [],
    referencesRead: outcome.referencesRead || [],
    stop: outcome.stop || null,
    ...(outcome.decidedKeysNotRaised ? { decidedKeysNotRaised: outcome.decidedKeysNotRaised } : {}),
    ...(outcome.decidedThroughInterfaceMethod ? { decidedThroughInterfaceMethod: outcome.decidedThroughInterfaceMethod } : {}),
  });
};

export const formatPlanLine = (plan, outcomeWord, resultsFolder) => `plan ${plan} ${outcomeWord} ${resultsFolder}`;

// The self-checks of each plan that holds a self-check file, in the order of the plans: the list the calling session writes from the selfCheck of each group.
export const readSelfChecksOfThePlans = resultsFolder => {
  const selfChecksOfThePlans = [];
  for (let plan = 1; plan <= findLastPlan(resultsFolder); plan++) {
    const selfCheckPath = path.join(getPlanFolder(resultsFolder, plan), SELF_CHECK_FILE);
    if (fs.existsSync(selfCheckPath)) selfChecksOfThePlans.push({ plan, groups: JSON.parse(fs.readFileSync(selfCheckPath, "utf8")) });
  }
  return selfChecksOfThePlans;
};
