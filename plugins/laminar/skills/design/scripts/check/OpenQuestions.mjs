import { isAText, readList } from "../model/DesignModel.mjs";
import { isAnOpenQuestion } from "../plan/PlanFolder.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";

const buildExitNamesOfQuestionMap = model => {
  const exitNamesOfQuestionMap = new Map();
  for (const exit of readList(model.decisions.exits)) {
    const questionId = exit.failure?.question;
    if (!isAText(questionId)) continue;

    if (!exitNamesOfQuestionMap.has(questionId)) exitNamesOfQuestionMap.set(questionId, new Set());
    exitNamesOfQuestionMap.get(questionId).add(exit.exit);
  }
  return exitNamesOfQuestionMap;
};

// A failure line is code that a writer writes, and a writer writes no code across a question with no answer, so a ready plan leaves no such question open (designing.md, section 1).
export const findOpenQuestionDefects = model => {
  const exitNamesOfQuestionMap = buildExitNamesOfQuestionMap(model);
  const defects = [];
  readList(model.decisions.questions).forEach((question, at) => {
    const exitNames = exitNamesOfQuestionMap.get(question.id);
    if (!exitNames || !isAnOpenQuestion(question)) return;

    defects.push(createDefect(DEFECT_CODES.OPEN_QUESTION_ON_WRITTEN_CODE, `decisions.questions[${at}]`, `the question ${question.id} holds no answer and its autonomous answer is open, and the failure line of the exit ${[...exitNames].join(", ")} names it, so its writer stops; ask the user, or where no user can answer, set autonomous to default and answer it with the option of its recommendation, by default`));
  });
  return defects;
};
