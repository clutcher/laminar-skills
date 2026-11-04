import { readList, readTypeNames } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect } from "../check/DesignDefect.mjs";
import { MIGRATION_STAGES } from "./MigrationSteps.mjs";

// The stages whose step writes the classes of its first file, so the step needs every class those classes name.
const STAGES_THAT_WRITE_A_CLASS = new Set([MIGRATION_STAGES.CREATED_CLASSES, MIGRATION_STAGES.CHANGED_MEMBERS, MIGRATION_STAGES.BODIES]);

const MIGRATION_PATH = "migration";

const listNamedTypeTexts = theClass => [
  ...readList(theClass.extends),
  ...readList(theClass.implements),
  ...readList(theClass.fields).map(field => field.type),
  ...readList(theClass.methods).flatMap(method => [method.returns, ...readList(method.parameters).map(parameter => parameter.type)]),
];

const listNamedClasses = (model, theClass) => {
  const typeClasses = listNamedTypeTexts(theClass).flatMap(readTypeNames).map(typeName => model.findClassOfTheType(typeName, theClass));
  const calledClasses = readList(theClass.methods).flatMap(method => readList(method.calls)).map(called => model.findClass(called));
  return [...new Set([...typeClasses, ...calledClasses])].filter(namedClass => namedClass && namedClass !== theClass);
};

const buildCreateStepOfFileMap = steps => new Map(steps
  .filter(step => step.stage === MIGRATION_STAGES.CREATED_CLASSES)
  .map(step => [step.files[0], step]));

const findLaterFileDefects = (step, createStepOfFileMap) => step.files
  .map(file => ({ file, createStep: createStepOfFileMap.get(file) }))
  .filter(({ createStep }) => createStep && createStep.group > step.group)
  .map(({ file, createStep }) => createDefect(DEFECT_CODES.GROUP_ORDER_BROKEN, MIGRATION_PATH, `step ${step.number} of migration group ${step.group} lists ${file}, and step ${createStep.number} creates that file in the later group ${createStep.group}`));

// A class written in 2 steps of 1 group, its members and then its bodies, is reported once for each class it names.
const findLaterClassDefects = (model, step, createStepOfFileMap, reportedPairs) => {
  if (!STAGES_THAT_WRITE_A_CLASS.has(step.stage)) return [];

  const defects = [];
  for (const writtenClass of model.classes.filter(theClass => theClass.file === step.files[0])) {
    for (const namedClass of listNamedClasses(model, writtenClass)) {
      const createStep = createStepOfFileMap.get(namedClass.file);
      const pairKey = `${model.getClassPath(writtenClass)} ${model.getClassPath(namedClass)}`;
      if (!createStep || createStep.group <= step.group || reportedPairs.has(pairKey)) continue;
      reportedPairs.add(pairKey);
      defects.push(createDefect(DEFECT_CODES.GROUP_ORDER_BROKEN, model.getClassPath(writtenClass), `step ${step.number} of migration group ${step.group} writes ${model.getClassDisplayName(writtenClass)}, which names ${model.getClassDisplayName(namedClass)}, and step ${createStep.number} creates ${model.getClassDisplayName(namedClass)} in the later group ${createStep.group}`));
    }
  }
  return defects;
};

// A step of 1 group that needs a file or a class a later group creates cannot build; the order is the designer's to change, so the plan only reports it.
export const findGroupOrderDefects = (model, steps) => {
  const createStepOfFileMap = buildCreateStepOfFileMap(steps);
  const reportedPairs = new Set();
  return steps.flatMap(step => [...findLaterFileDefects(step, createStepOfFileMap), ...findLaterClassDefects(model, step, createStepOfFileMap, reportedPairs)]);
};
