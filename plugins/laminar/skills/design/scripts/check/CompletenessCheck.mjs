import { ANSWER_GIVERS, DOES, FRAMEWORK, KINDS, OVERRIDE_KINDS, getFileOfTheChild, isAText, isATestFileOfTheModel, isAnInterface, isLeftUnfixed, isMarkedUnchanged, readFolderOfTheFile, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";
import { joinNameOfTheTwoKeys } from "./DefectNames.mjs";
import { createTestNameForm } from "./TestNameForm.mjs";
import { isAStopOnItsGroup } from "../plan/StopList.mjs";

const HIGH = "high";

const QUESTION_OPTIONS_AT_LEAST = 2;

const PARTS_OF_A_COORDINATING_METHOD = 2;

const KINDS_OF_AN_OLD_FILE = new Set([KINDS.REMOVED, KINDS.MODIFIED]);

const KINDS_THAT_LIST_FIELD_TYPES = new Set([KINDS.CREATED, KINDS.MODIFIED]);

// The constants of an enum are values of the enum itself, so they carry no type of their own.
const ENUM_KIND_WORD = "enum";

const isPresent = value => {
  if (Array.isArray(value)) return true;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
};

const isAnObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);

class CompletenessCheck {
  constructor(model, zoneOrder) {
    this.model = model;
    this.zoneOrder = zoneOrder;
    this.defects = [];
    this.keyCountMap = new Map();
    this.libraryTypeNames = new Set();
    this.testNameForm = createTestNameForm(model.decisions.conventions?.testNameForms, model.listMethodsWithClass().map(({ method }) => method.name));
  }

  requireKey(keyLabel, keyParent, key, path, missingCode = DEFECT_CODES.KEY_MISSING) {
    const count = this.keyCountMap.get(keyLabel) || { present: 0, needed: 0 };
    count.needed += 1;
    const isKeyPresent = isPresent(keyParent[key]);
    if (isKeyPresent) count.present += 1;
    this.keyCountMap.set(keyLabel, count);
    if (!isKeyPresent) this.defects.push(createDefect(missingCode, `${path}.${key}`, `the key ${key} is required here and is missing`));
    return isKeyPresent;
  }

  // A key that no rule asks for still counts where it stands, so the count shows every value the model holds.
  countGivenKey(keyLabel) {
    const count = this.keyCountMap.get(keyLabel) || { present: 0, needed: 0 };
    count.needed += 1;
    count.present += 1;
    this.keyCountMap.set(keyLabel, count);
  }

  requireName(displayName, path) {
    if (!isPresent(displayName)) return;
    if (this.model.isAnAmbiguousName(displayName)) {
      this.defects.push(createDefect(DEFECT_CODES.NAME_AMBIGUOUS, path, `${displayName} is the name of 2 or more classes of the model, so it starts with the file of its class, as <file>#${displayName}`));
      return;
    }
    if (this.model.holdsTheName(displayName)) return;
    this.defects.push(createDefect(DEFECT_CODES.NAME_UNRESOLVED, path, `${displayName} names no class or method of the model`));
  }

  requireTestNames(testNames, path) {
    readList(testNames).forEach((testName, at) => {
      if (this.testNameForm.fits(testName)) return;
      this.defects.push(createDefect(DEFECT_CODES.TEST_NAME_FORM, `${path}[${at}]`, `the test name ${testName} ${this.testNameForm.describe()}`));
    });
  }

  addDefect(code, path, sentence) {
    this.defects.push(createDefect(code, path, sentence));
  }
}

const checkOldFile = (check, child, childPath) => {
  if (child.kind !== KINDS.CREATED || !isAText(child.oldPath)) return;

  const oldChild = check.model.findChildOfTheFile(child.oldPath);
  if (oldChild && KINDS_OF_AN_OLD_FILE.has(oldChild.kind)) return;
  check.addDefect(DEFECT_CODES.OLD_FILE_UNLISTED, `${childPath}.oldPath`, `the code of ${child.name} comes from ${child.oldPath}, and no folder of the model lists that file as a removed or modified child`);
};

// The migration places the step that creates a file, or removes classes from it, in the group of the classes of the model in that file, and a test file often holds none, so its step would fall to group 1 with no class to say so.
const checkGroupOfTheTestFile = (check, file, child, childPath) => {
  const { model } = check;
  const isPlacedByItsClasses = child.kind === KINDS.CREATED || readList(child.removedClasses).length > 0;
  if (!isPlacedByItsClasses || !isATestFileOfTheModel(model, file)) return;
  if (model.isAFolderChild(file)) return;
  if (model.classes.some(theClass => theClass.file === file)) return;

  check.addDefect(DEFECT_CODES.TEST_WITHOUT_GROUP, childPath, `the test file ${file} holds no class of the model, so no migration group takes its step; name its tests under decisions.tests, or list the class it holds`);
};

const checkFolders = check => {
  check.model.folders.forEach((folder, folderAt) => {
    const path = `folders[${folderAt}]`;
    check.requireKey("folder.path", folder, "path", path);
    check.requireKey("folder.kind", folder, "kind", path);
    readList(folder.children).forEach((child, childAt) => {
      const childPath = `${path}.children[${childAt}]`;
      check.requireKey("child.name", child, "name", childPath);
      check.requireKey("child.kind", child, "kind", childPath);
      if (child.kind === KINDS.MOVED) check.requireKey("child.oldPath", child, "oldPath", childPath);
      checkOldFile(check, child, childPath);
      checkGroupOfTheTestFile(check, getFileOfTheChild(folder, child), child, childPath);
    });
  });
};

const needsADoesValue = theClass => !isAnInterface(theClass) && readList(theClass.methods).length > 0;

const needsABody = (model, theClass, method, exitNames) => {
  if (isAnInterface(theClass) || isMarkedUnchanged(method)) return false;

  const calls = new Set(readList(method.calls).filter(isAText).map(called => model.normalizeName(called)));
  return calls.size >= PARTS_OF_A_COORDINATING_METHOD || [...calls].some(called => exitNames.has(called));
};

const checkUses = (check, theClass, method, methodPath) => {
  const memberNames = new Set([...readList(theClass.fields).map(field => field.name), ...readList(theClass.methods).map(other => other.name)]);
  readList(method.uses).forEach((use, at) => {
    if (memberNames.has(use)) return;
    check.addDefect(DEFECT_CODES.USE_UNRESOLVED, `${methodPath}.uses[${at}]`, `${use} is no field and no method of ${theClass.name}`);
  });
};

const checkUnchangedMark = (check, theClass, method, methodPath) => {
  if (!isMarkedUnchanged(method)) return;

  const changedKey = ["body", "oldName"].find(key => isAText(method[key]));
  if (changedKey) check.addDefect(DEFECT_CODES.METHOD_CHANGED_BUT_MARKED_UNCHANGED, `${methodPath}.${changedKey}`, `${theClass.name}#${method.name} is marked unchanged and holds ${changedKey === "body" ? "a body" : "an oldName"}`);
};

const checkClasses = check => {
  const { model } = check;
  const exitNames = model.getExitNames();
  for (const theClass of model.classes) {
    const path = model.getClassPath(theClass);
    const isChanged = model.isChangedClass(theClass);
    check.requireKey("class.file", theClass, "file", path);
    check.requireKey("class.name", theClass, "name", path);
    if (isChanged) {
      if (check.zoneOrder.appliesToTheFolder(readFolderOfTheFile(theClass.file))) check.requireKey("class.zone", theClass, "zone", path);
      check.requireKey("class.exposed", theClass, "exposed", path);
      if (needsADoesValue(theClass)) check.requireKey("class.does", theClass, "does", path);
    }
    const kind = model.getKindOfClass(theClass);
    if (kind === KINDS.UNCHANGED && Number.isFinite(theClass.group)) check.addDefect(DEFECT_CODES.GROUP_ON_UNCHANGED_CLASS, `${path}.group`, `${model.getClassDisplayName(theClass)} stands in an unchanged file and holds group ${theClass.group}, and only a class the change touches takes a migration group`);
    if (KINDS_THAT_LIST_FIELD_TYPES.has(kind) && theClass.kindWord !== ENUM_KIND_WORD) {
      readList(theClass.fields).forEach((field, at) => {
        if (!isAText(field.type)) check.addDefect(DEFECT_CODES.FIELD_WITHOUT_TYPE, `${path}.fields[${at}]`, `the field ${field.name} of ${theClass.name}, a class of a ${kind} file, has no type that says its unit or form`);
      });
    }

    for (const method of readList(theClass.methods)) {
      const methodPath = model.getMethodPath(theClass, method);
      check.requireKey("method.name", method, "name", methodPath);
      if (isChanged && needsABody(model, theClass, method, exitNames)) check.requireKey("method.body", method, "body", methodPath);
      else if (isAText(method.body)) check.countGivenKey("method.body");
      readList(method.calls).forEach((called, at) => check.requireName(called, `${methodPath}.calls[${at}]`));
      checkUses(check, theClass, method, methodPath);
      checkUnchangedMark(check, theClass, method, methodPath);
    }
  }
};

const checkClassNamesOnce = check => {
  for (const [className, classes] of check.model.classesOfNameMap) {
    const files = classes.map(theClass => theClass.file);
    const fileTwice = files.find((file, at) => files.indexOf(file) !== at);
    if (fileTwice === undefined) continue;
    check.addDefect(DEFECT_CODES.CLASS_NAME_TWICE, check.model.getClassPath(classes[files.lastIndexOf(fileTwice)]), `the class name ${className} is declared twice in ${fileTwice}`);
  }
};

// A proposed rule has no project file yet, so it names the question whose answer of the user states it, and the text of the rule.
const KEYS_OF_OVERRIDE_KIND_MAP = new Map([
  [OVERRIDE_KINDS.OVERRIDE, ["project", "codeStyle", "says"]],
  [OVERRIDE_KINDS.CONTRADICTION, ["project", "codeStyle", "says"]],
  [OVERRIDE_KINDS.PROPOSED, ["codeStyle", "says", "rule", "question"]],
]);

const checkOverrides = (check, overrides) => {
  const questionIds = new Set(readList(check.model.decisions.questions).map(question => question.id));
  overrides.forEach((override, at) => {
    const path = `decisions.conventions.overrides[${at}]`;
    if (!check.requireKey("override.kind", override, "kind", path)) return;

    for (const key of KEYS_OF_OVERRIDE_KIND_MAP.get(override.kind) || []) check.requireKey(`override.${key}`, override, key, path);
    if (override.kind === OVERRIDE_KINDS.PROPOSED && isAText(override.question) && !questionIds.has(override.question)) check.addDefect(DEFECT_CODES.QUESTION_UNKNOWN, `${path}.question`, `the question ${override.question} is no id of decisions.questions`);
  });
};

const checkConventions = check => {
  const { conventions } = check.model.decisions;
  if (!isAnObject(conventions)) {
    check.requireKey("decisions.conventions", check.model.decisions, "conventions", "decisions");
    return;
  }
  for (const key of ["folder", "found", "files", "zoneOrder"]) check.requireKey(`conventions.${key}`, conventions, key, "decisions.conventions");
  checkOverrides(check, readList(conventions.overrides));
};

const checkForecast = (check, forecast, path) => {
  for (const key of ["sixMonths", "oneYear", "threeYears", "change", "evidence", "reason"]) check.requireKey(`forecast.${key}`, forecast, key, path);
};

const isHighWithinOneYear = forecast => forecast.sixMonths === HIGH || forecast.oneYear === HIGH;

const checkOwner = (check, owner, path, entryNames) => {
  check.requireKey("owner.decision", owner, "decision", path);
  if (check.requireKey("owner.owner", owner, "owner", path)) check.requireName(owner.owner, `${path}.owner`);
  check.requireKey("owner.placement", owner, "placement", path, DEFECT_CODES.OWNER_PLACEMENT_MISSING);
  if (check.requireKey("owner.callers", owner, "callers", path)) {
    readList(owner.callers).forEach((caller, at) => {
      if (caller !== FRAMEWORK) check.requireName(caller, `${path}.callers[${at}]`);
    });
    if (!readList(owner.callers).length && !entryNames.has(owner.owner)) check.addDefect(DEFECT_CODES.OWNER_WITHOUT_CALLERS, `${path}.callers`, `the owner ${owner.owner} has no callers, and only an entry may have none; a method the host framework calls lists ${FRAMEWORK}`);
  }
  if (!check.requireKey("owner.forecast", owner, "forecast", path)) return;

  checkForecast(check, owner.forecast, `${path}.forecast`);
  if (isHighWithinOneYear(owner.forecast) && !isAnObject(owner.depth)) check.addDefect(DEFECT_CODES.DEPTH_MISSING, `${path}.depth`, `the forecast of "${owner.decision}" is high within 1 year, and the owner states no depth`);
  if (isAnObject(owner.depth)) {
    for (const key of ["shape", "takenBy", "reason"]) check.requireKey(`depth.${key}`, owner.depth, key, `${path}.depth`);
  }
};

const checkOwners = check => {
  const owners = readList(check.model.decisions.owners);
  const entryNames = new Set(readList(check.model.decisions.entries).map(entry => entry.entry));
  const ownerOfDecisionMap = new Map();
  owners.forEach((owner, at) => {
    const path = `decisions.owners[${at}]`;
    checkOwner(check, owner, path, entryNames);
    if (!isAText(owner.decision) || !isAText(owner.owner)) return;

    const earlierOwner = ownerOfDecisionMap.get(owner.decision);
    if (earlierOwner && earlierOwner !== owner.owner) check.addDefect(DEFECT_CODES.DECISION_WITH_TWO_OWNERS, `${path}.owner`, `the decision "${owner.decision}" has 2 owners, ${earlierOwner} and ${owner.owner}`);
    if (!earlierOwner) ownerOfDecisionMap.set(owner.decision, owner.owner);
  });
};

const checkValidations = (check, entry, path) => {
  readList(entry.validates).forEach((validation, validationAt) => {
    const validationPath = `${path}.validates[${validationAt}]`;
    for (const key of ["data", "check"]) check.requireKey(`validates.${key}`, validation, key, validationPath);
    if (check.requireKey("validates.at", validation, "at", validationPath)) check.requireName(validation.at, `${validationPath}.at`);
  });
  if (entry.changed !== false && readList(entry.reads).length && !readList(entry.validates).length) check.addDefect(DEFECT_CODES.ENTRY_WITHOUT_VALIDATION, `${path}.validates`, `the entry ${entry.entry} reads outside data and validates none of it`);
};

// A response type is a class of the model or a library type as the code writes it; the word framework names who handles a failure, never a type.
const checkResponseType = (check, typeName, path) => {
  if (typeName === FRAMEWORK) {
    check.addDefect(DEFECT_CODES.FRAMEWORK_AS_RESPONSE_TYPE, path, `the response type is the word ${FRAMEWORK}, which names a handler and no type; a response the framework writes names its type and carries handledAt ${FRAMEWORK}`);
    return;
  }
  if (check.model.isAnAmbiguousName(typeName) || check.model.holdsTheName(typeName)) check.requireName(typeName, path);
  else check.libraryTypeNames.add(typeName);
};

const checkResponses = (check, entry, path) => {
  readList(entry.responses).forEach((response, at) => {
    const responsePath = `${path}.responses[${at}]`;
    for (const key of ["outcome", "status"]) check.requireKey(`response.${key}`, response, key, responsePath);
    if (check.requireKey("response.type", response, "type", responsePath)) checkResponseType(check, response.type, `${responsePath}.type`);
  });
};

const checkEntries = check => {
  const testedEntries = new Set(readList(check.model.decisions.tests?.integration).map(integration => integration.entry));
  readList(check.model.decisions.entries).forEach((entry, at) => {
    const path = `decisions.entries[${at}]`;
    if (check.requireKey("entry.entry", entry, "entry", path)) check.requireName(entry.entry, `${path}.entry`);
    check.requireKey("entry.changed", entry, "changed", path);
    check.requireKey("entry.reads", entry, "reads", path);
    if (check.requireKey("entry.validates", entry, "validates", path)) checkValidations(check, entry, path);
    if (check.requireKey("entry.handler", entry, "handler", path) && entry.handler !== FRAMEWORK) check.requireName(entry.handler, `${path}.handler`);
    if (check.requireKey("entry.responses", entry, "responses", path)) checkResponses(check, entry, path);
    if (isAText(entry.entry) && !testedEntries.has(entry.entry)) check.addDefect(DEFECT_CODES.ENTRY_WITHOUT_INTEGRATION_TESTS, path, `decisions.tests.integration holds no object for the entry ${entry.entry}`);
  });
};

const checkExits = check => {
  const questionIds = new Set(readList(check.model.decisions.questions).map(question => question.id));
  readList(check.model.decisions.exits).forEach((exit, at) => {
    const path = `decisions.exits[${at}]`;
    if (check.requireKey("exit.exit", exit, "exit", path)) check.requireName(exit.exit, `${path}.exit`);
    if (check.requireKey("exit.from", exit, "from", path)) check.requireName(exit.from, `${path}.from`);
    check.requireKey("exit.does", exit, "does", path);
    if (!check.requireKey("exit.failure", exit, "failure", path)) return;

    const failurePath = `${path}.failure`;
    check.requireKey("failure.failed", exit.failure, "failed", failurePath);
    if (check.requireKey("failure.handledAt", exit.failure, "handledAt", failurePath) && exit.failure.handledAt !== FRAMEWORK) check.requireName(exit.failure.handledAt, `${failurePath}.handledAt`);
    if (isAText(exit.failure.question) && !questionIds.has(exit.failure.question)) check.addDefect(DEFECT_CODES.QUESTION_UNKNOWN, `${failurePath}.question`, `the question ${exit.failure.question} is no id of decisions.questions`);
  });
};

const checkIntegrationTests = (check, integrations) => {
  const entryNames = new Set(readList(check.model.decisions.entries).map(entry => entry.entry));
  integrations.forEach((integration, at) => {
    const path = `decisions.tests.integration[${at}]`;
    if (check.requireKey("integration.entry", integration, "entry", path)) {
      check.requireName(integration.entry, `${path}.entry`);
      if (!entryNames.has(integration.entry)) check.addDefect(DEFECT_CODES.INTEGRATION_WITHOUT_ENTRY, `${path}.entry`, `the integration tests name the entry ${integration.entry}, which decisions.entries does not hold`);
    }
    check.requireKey("integration.file", integration, "file", path);
    if (check.requireKey("integration.substitutes", integration, "substitutes", path)) readList(integration.substitutes).forEach((substitute, substituteAt) => check.requireName(substitute, `${path}.substitutes[${substituteAt}]`));
    if (check.requireKey("integration.tests", integration, "tests", path)) check.requireTestNames(integration.tests, `${path}.tests`);
  });
};

const checkUnitTests = (check, unitTests) => {
  unitTests.forEach((unitTest, at) => {
    const path = `decisions.tests.unit[${at}]`;
    if (check.requireKey("unit.class", unitTest, "class", path)) check.requireName(unitTest.class, `${path}.class`);
    check.requireKey("unit.file", unitTest, "file", path);
    if (check.requireKey("unit.tests", unitTest, "tests", path)) check.requireTestNames(unitTest.tests, `${path}.tests`);
    const theClass = check.model.findClass(unitTest.class);
    if (theClass && theClass.does === DOES.COORDINATES) check.defects.push(createRecheckDefect(DEFECT_CODES.UNIT_TESTS_OF_A_COORDINATOR, `${path}.class`, `${unitTest.class} coordinates, so a unit test of it needs a substitute for each part it calls; its branches belong to integration tests`));
  });
};

// The step of a removed test goes to the group of its class, and only a class the change changes or removes has a group: a class of a removed file, or a name under removedClasses, which the model often holds no class for.
const checkClassOfTheRemovedTest = (check, className, path) => {
  const { model } = check;
  if (model.findFileThatRemovesTheClass(className)) return;

  check.requireName(className, path);
  const theClass = model.findClass(className);
  if (!theClass || model.isChangedClass(theClass) || model.isRemovedClass(theClass)) return;
  check.addDefect(DEFECT_CODES.TEST_WITHOUT_GROUP, path, `${className} is a class the change neither changes nor removes, so no migration group removes the test`);
};

const checkRemovedTests = (check, removedTests) => {
  removedTests.forEach((removedTest, at) => {
    const path = `decisions.tests.removed[${at}]`;
    if (check.requireKey("removed.class", removedTest, "class", path)) checkClassOfTheRemovedTest(check, removedTest.class, `${path}.class`);
    for (const key of ["file", "test", "why"]) check.requireKey(`removed.${key}`, removedTest, key, path);
  });
};

const checkTests = check => {
  const { tests } = check.model.decisions;
  if (!check.requireKey("decisions.tests", check.model.decisions, "tests", "decisions")) return;

  checkIntegrationTests(check, readList(tests.integration));
  checkUnitTests(check, readList(tests.unit));
  checkRemovedTests(check, readList(tests.removed));
};

const checkAnswer = (check, question, path) => {
  if (!isAnObject(question.answer)) return;

  const optionNames = readList(question.options).map(option => option.name);
  if (!optionNames.includes(question.answer.option)) check.addDefect(DEFECT_CODES.ANSWER_OPTION_UNKNOWN, `${path}.answer.option`, `the answer ${JSON.stringify(question.answer.option)} is no option of the question ${question.id}`);
  check.requireKey("answer.by", question.answer, "by", `${path}.answer`);
  if (question.answer.by === ANSWER_GIVERS.DELEGATE) check.requireKey("answer.says", question.answer, "says", `${path}.answer`);
};

// An option that adds, removes, merges or splits a class shows its code, so the user decides on the code and not on a name: its shape says so by its words, or it removes or merges a class that the model holds.
const CLASS_CHANGE_WORDS = /\b(?:new|add(?:s|ed)?|creat(?:e|es|ed)|remov(?:e|es|ed)|merg(?:e|es|ed)|split(?:s)?|drop(?:s|ped)?)\b[^.;]*\b(?:class|classes|type|types|interface|interfaces|record|records|enum)\b/i;

const REMOVING_WORDS = /\b(?:remov(?:e|es|ed)|merg(?:e|es|ed)|drop(?:s|ped)?|delet(?:e|es|ed))\b/i;

const CAMEL_CASE_NAME = /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+\b/g;

const removesAClassOfTheModel = (model, shape) => REMOVING_WORDS.test(shape) && (shape.match(CAMEL_CASE_NAME) || []).some(name => Boolean(model.findClass(name)));

const changesAClass = (model, option) => {
  const shape = String(option.shape || "");
  return CLASS_CHANGE_WORDS.test(shape) || removesAClassOfTheModel(model, shape);
};

const checkOptionCode = (check, question, option, path) => {
  if (isAText(option.code) || !changesAClass(check.model, option)) return;
  check.addDefect(DEFECT_CODES.OPTION_WITHOUT_CODE, `${path}.code`, `the option ${option.name} of the question ${question.id} adds, removes, merges or splits a class, and holds no code`);
};

const checkOptions = (check, question, path) => {
  if (!check.requireKey("question.options", question, "options", path)) return;

  readList(question.options).forEach((option, at) => {
    for (const key of ["name", "shape"]) check.requireKey(`option.${key}`, option, key, `${path}.options[${at}]`);
    checkOptionCode(check, question, option, `${path}.options[${at}]`);
  });
  if (readList(question.options).length < QUESTION_OPTIONS_AT_LEAST) check.addDefect(DEFECT_CODES.QUESTION_OPTIONS_TOO_FEW, `${path}.options`, `the question ${question.id} gives fewer than ${QUESTION_OPTIONS_AT_LEAST} options`);
};

const checkQuestions = check => {
  readList(check.model.decisions.questions).forEach((question, at) => {
    const path = `decisions.questions[${at}]`;
    for (const key of ["id", "fact", "recommendation", "autonomous"]) check.requireKey(`question.${key}`, question, key, path);
    checkOptions(check, question, path);
    checkAnswer(check, question, path);
  });
};

const checkStops = check => {
  readList(check.model.decisions.stops).forEach((stop, at) => {
    const path = `decisions.stops[${at}]`;
    check.requireKey("stop.reason", stop, "reason", path);
    // A stop on a group with no class names its group, which no name of the model resolves.
    if (check.requireKey("stop.at", stop, "at", path) && !isAStopOnItsGroup(stop)) check.requireName(stop.at, `${path}.at`);
    check.requireKey("stop.says", stop, "says", path);
    // A stop of 0.72.0 names its round, which is the number of its plan since 0.73.0.
    if (stop.round === undefined) check.requireKey("stop.plan", stop, "plan", path);
  });
};

// The fix of an existing defect stands in a group of its own, so the author reads it apart from the change.
const checkExistingDefects = check => {
  const classGroups = new Set(check.model.classes.map(theClass => theClass.group).filter(Number.isFinite));
  readList(check.model.decisions.existingDefects).forEach((existingDefect, at) => {
    const path = `decisions.existingDefects[${at}]`;
    if (check.requireKey("existingDefect.class", existingDefect, "class", path)) check.requireName(existingDefect.class, `${path}.class`);
    for (const key of ["member", "defect"]) check.requireKey(`existingDefect.${key}`, existingDefect, key, path);
    const isFixed = isAText(existingDefect.fix) || Number.isFinite(existingDefect.group);
    const name = joinNameOfTheTwoKeys(existingDefect.class, existingDefect.member) ?? path;
    if (isFixed && isLeftUnfixed(existingDefect)) {
      check.addDefect(DEFECT_CODES.EXISTING_DEFECT_FIXED_AND_NOT_FIXED, path, `the existing defect of ${name} holds notFixed beside fix or group, and a defect left unfixed has neither`);
      return;
    }
    if (!isFixed && !isLeftUnfixed(existingDefect)) {
      check.addDefect(DEFECT_CODES.EXISTING_DEFECT_NEITHER_FIXED_NOR_NOT_FIXED, path, `the existing defect of ${name} holds neither fix and group nor notFixed, and holds 1 of them`);
      return;
    }
    if (!isFixed) return;

    for (const key of ["fix", "group"]) check.requireKey(`existingDefect.${key}`, existingDefect, key, path);
    if (classGroups.has(existingDefect.group)) check.addDefect(DEFECT_CODES.EXISTING_DEFECT_GROUP_TAKEN, `${path}.group`, `the fix of ${existingDefect.class}#${existingDefect.member} stands in group ${existingDefect.group}, which a class of the model also takes`);
  });
};

const checkScriptCases = check => {
  readList(check.model.decisions.scriptCases).forEach((scriptCase, at) => {
    for (const key of ["code", "name", "text", "reason"]) check.requireKey(`scriptCase.${key}`, scriptCase, key, `decisions.scriptCases[${at}]`);
  });
};

export const findCompletenessDefects = (model, zoneOrder) => {
  const check = new CompletenessCheck(model, zoneOrder);
  checkFolders(check);
  checkClasses(check);
  checkClassNamesOnce(check);
  checkConventions(check);
  checkOwners(check);
  checkEntries(check);
  checkExits(check);
  checkTests(check);
  checkQuestions(check);
  checkStops(check);
  checkExistingDefects(check);
  checkScriptCases(check);
  return { defects: check.defects, keyCountMap: check.keyCountMap, libraryTypeNames: [...check.libraryTypeNames] };
};
