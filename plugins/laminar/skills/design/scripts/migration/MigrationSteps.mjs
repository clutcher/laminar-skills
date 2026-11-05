import path from "node:path";
import { KINDS, getFileOfTheChild, getFolderPath, isAText, isAnInterface, isLeftUnfixed, isMarkedUnchanged, readList, readTypeNames } from "../model/DesignModel.mjs";
import { isAReadExtension, isATestFile } from "../model/SourceLanguages.mjs";

export const MIGRATION_STAGES = Object.freeze({
  FOLDERS: "folders",
  MOVES_AND_RENAMES: "moves and renames",
  CREATED_CLASSES: "created classes",
  CHANGED_MEMBERS: "changed members",
  BODIES: "bodies",
  REMOVALS: "removals",
  TESTS: "tests",
});

const STAGE_ORDER = Object.values(MIGRATION_STAGES);

const FOLDER_KINDS_THAT_CREATE = new Set([KINDS.CREATED, KINDS.MOVED]);

const FIRST_GROUP = 1;

const TESTS_NOT_FOUND = "tests not found, language not read";

const PRIVATE_VISIBILITY = "private";

const joinNames = names => names.join(", ");

const isAPublicMethod = method => method.visibility !== PRIVATE_VISIBILITY;

const readLastNamePiece = className => className.split(".").pop();

const getGroupOfTheClass = theClass => (Number.isFinite(theClass.group) ? theClass.group : FIRST_GROUP);

class MigrationPlan {
  constructor(model, currentTree) {
    this.model = model;
    this.currentTree = currentTree;
    const folderPaths = new Set(model.folders.map(getFolderPath));
    this.children = model.folders
      .flatMap(folder => readList(folder.children).map(child => ({ folder, child, file: getFileOfTheChild(folder, child) })))
      .filter(({ file }) => !folderPaths.has(file.replace(/\/+$/, "")));
    this.createdFiles = new Set(this.children.filter(({ child }) => child.kind === KINDS.CREATED).map(({ file }) => file));
    this.newFileOfOldPathMap = new Map(this.children.filter(({ child }) => child.kind === KINDS.MOVED && isAText(child.oldPath)).map(({ child, file }) => [child.oldPath, file]));
    this.removedFiles = new Set(this.children.filter(({ child }) => child.kind === KINDS.REMOVED).map(({ file }) => file));
    this.createdFileOfRemovedFileMap = new Map(this.children
      .filter(({ child }) => child.kind === KINDS.CREATED && isAText(child.oldPath) && this.removedFiles.has(child.oldPath))
      .map(({ child, file }) => [child.oldPath, file]));
    this.lastGroup = Math.max(FIRST_GROUP, ...model.classes.map(getGroupOfTheClass));
    this.existingDefects = readList(model.decisions.existingDefects).filter(existingDefect => Number.isFinite(existingDefect.group) && !isLeftUnfixed(existingDefect));
  }

  listExistingDefectsOf(theClass) {
    return this.existingDefects.filter(existingDefect => this.model.findClass(existingDefect.class) === theClass);
  }

  isFixedApart(theClass, memberName) {
    return this.listExistingDefectsOf(theClass).some(existingDefect => existingDefect.member === memberName);
  }

  listClassesOfTheFile(file) {
    return this.model.classes.filter(theClass => theClass.file === file);
  }

  getGroupOfClasses(classes, emptyGroup = FIRST_GROUP) {
    return classes.length ? Math.min(...classes.map(getGroupOfTheClass)) : emptyGroup;
  }

  getGroupOfTheFile(file, emptyGroup = FIRST_GROUP) {
    return this.getGroupOfClasses(this.listClassesOfTheFile(file), emptyGroup);
  }

  createStep(stage, group, says, files) {
    return { stage, group, says, files: [...new Set(files)] };
  }

  listImportingFiles(className, oldFile, newFile) {
    if (!this.currentTree) return [];

    const oldFolder = isAText(oldFile) ? path.posix.dirname(oldFile) : null;
    const leavesItsFolder = oldFolder !== null && oldFolder !== path.posix.dirname(newFile);
    const sameFolderFiles = leavesItsFolder ? this.currentTree.listFilesThatHoldEveryWord([className]).filter(file => path.posix.dirname(file) === oldFolder) : [];
    const importingFiles = [...this.currentTree.listFilesThatImportTheClass(className, oldFile), ...sameFolderFiles]
      .map(file => this.newFileOfOldPathMap.get(file) || file)
      .filter(file => file !== oldFile && file !== newFile && !this.createdFiles.has(file) && !this.removedFiles.has(file));
    return [...new Set(importingFiles)];
  }

  describeImportUpdate(importingFiles) {
    return importingFiles.length ? `; updates the imports of ${joinNames(importingFiles)}` : "";
  }

  listFilesOfTheModelThat(isTheCaller) {
    return this.model.classes.filter(isTheCaller).map(theClass => theClass.file);
  }

  listCallerFiles(words, isTheCallerInTheModel, className, classFile) {
    const treeFiles = this.currentTree ? this.currentTree.listFilesThatReferToTheClass(words, className, classFile).map(file => this.newFileOfOldPathMap.get(file) || file) : [];
    return [...treeFiles, ...this.listFilesOfTheModelThat(isTheCallerInTheModel)].filter(file => !this.createdFiles.has(file));
  }

  callsAny(theClass, isTheCalled) {
    return readList(theClass.methods).some(method => readList(method.calls).some(called => isTheCalled(this.model.findClass(called), called)));
  }

  namesTheClass(theClass, namedClass) {
    return this.callsAny(theClass, calledClass => calledClass === namedClass)
      || readList(theClass.fields).some(field => readTypeNames(field.type).some(typeName => this.model.findClassOfTheType(typeName, theClass) === namedClass));
  }

  listFolderSteps() {
    return this.model.folders
      .filter(folder => FOLDER_KINDS_THAT_CREATE.has(folder.kind))
      .map(folder => {
        const folderPath = `${getFolderPath(folder)}/`;
        const group = this.getGroupOfClasses(this.model.classes.filter(theClass => isAText(theClass.file) && theClass.file.startsWith(folderPath)));
        return this.createStep(MIGRATION_STAGES.FOLDERS, group, `creates the folder ${folderPath}`, [folderPath]);
      });
  }

  listMoveSteps() {
    return this.children.filter(({ child }) => child.kind === KINDS.MOVED && isAText(child.oldPath)).map(({ child, file }) => {
      const classes = this.listClassesOfTheFile(file);
      const verb = path.posix.basename(child.oldPath) === child.name ? "moves" : "renames and moves";
      const callerFiles = classes.flatMap(movedClass => this.listCallerFiles([movedClass.name], theClass => theClass !== movedClass && this.namesTheClass(theClass, movedClass), movedClass.oldName || movedClass.name, child.oldPath));
      const importingFiles = [...new Set(classes.flatMap(movedClass => this.listImportingFiles(movedClass.oldName || movedClass.name, child.oldPath, file)))];
      const says = `${verb} ${child.oldPath} to ${file}, with no change of behavior${this.describeImportUpdate(importingFiles)}`;
      return this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, this.getGroupOfClasses(classes), says, [child.oldPath, file, ...callerFiles.filter(callerFile => callerFile !== file), ...importingFiles]);
    });
  }

  listRenameSteps() {
    const steps = [];
    for (const theClass of this.model.classes) {
      const group = getGroupOfTheClass(theClass);
      if (isAText(theClass.oldName)) {
        const callerFiles = this.listCallerFiles([theClass.oldName], other => other !== theClass && this.namesTheClass(other, theClass), theClass.oldName, this.readCurrentFileOf(theClass.file));
        const importingFiles = this.listImportingFiles(theClass.oldName, theClass.file, theClass.file);
        steps.push(this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, group, `renames the class ${theClass.oldName} to ${theClass.name}, with no change of behavior${this.describeImportUpdate(importingFiles)}`, [theClass.file, ...callerFiles, ...importingFiles]));
      }
      for (const method of readList(theClass.methods)) {
        if (!isAText(method.oldName)) continue;
        const callerFiles = this.listCallerFiles([theClass.oldName || theClass.name, method.oldName], other => this.callsAny(other, (calledClass, called) => calledClass === theClass && called.endsWith(`#${method.name}`)), theClass.oldName || theClass.name, this.readCurrentFileOf(theClass.file));
        steps.push(this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, group, `renames ${this.model.getClassDisplayName(theClass)}#${method.oldName} to ${method.name}, with no change of behavior`, [theClass.file, ...callerFiles]));
      }
    }
    return steps;
  }

  describeCreatedFile(file) {
    const classes = this.listClassesOfTheFile(file);
    if (!classes.length) return "";

    const methods = classes.filter(theClass => !isAnInterface(theClass)).flatMap(theClass => readList(theClass.methods).map(method => ({ theClass, method })));
    const bodies = methods.length ? ` and the bodies of ${joinNames(methods.map(({ theClass, method }) => this.model.getMethodDisplayName(theClass, method)))}` : "";
    const givenBodies = methods.filter(({ method }) => isAText(method.body)).map(({ theClass, method }) => this.model.getMethodDisplayName(theClass, method));
    const given = givenBodies.length ? `, with the bodies the model gives for ${joinNames(givenBodies)}` : "";
    return ` with ${joinNames(classes.map(theClass => theClass.name))}${bodies}${given}`;
  }

  listCreatedClassSteps() {
    const createdChildOfFileMap = new Map(this.children.filter(({ child }) => child.kind === KINDS.CREATED).map(({ child, file }) => [file, child]));
    return this.orderFilesCalledFirst([...createdChildOfFileMap.keys()]).flatMap(file => {
      const child = createdChildOfFileMap.get(file);
      const group = this.getGroupOfTheFile(file);
      const takesFrom = isAText(child.oldPath) ? `, taking its code from ${child.oldPath}` : "";
      const importingFiles = isAText(child.oldPath) ? [...new Set(this.listClassesOfTheFile(file).flatMap(theClass => this.listImportingFiles(theClass.oldName || theClass.name, child.oldPath, file)))] : [];
      const says = `creates ${file}${this.describeCreatedFile(file)}${takesFrom}${this.describeImportUpdate(importingFiles)}`;
      const createStep = this.createStep(MIGRATION_STAGES.CREATED_CLASSES, group, says, isAText(child.oldPath) ? [file, child.oldPath, ...importingFiles] : [file]);
      if (this.createdFileOfRemovedFileMap.get(child.oldPath) !== file) return [createStep];

      const removalStep = { ...this.createStep(MIGRATION_STAGES.REMOVALS, group, `removes the file ${child.oldPath}, whose code ${file} now holds`, [child.oldPath]), rank: MIGRATION_STAGES.CREATED_CLASSES };
      return [createStep, removalStep];
    });
  }

  listChangedMemberSteps() {
    return this.children
      .filter(({ child }) => child.kind === KINDS.MODIFIED)
      .map(({ file }) => ({ file, classes: this.listClassesOfTheFile(file) }))
      .filter(({ classes }) => classes.length)
      .map(({ file, classes }) => this.createStep(MIGRATION_STAGES.CHANGED_MEMBERS, this.getGroupOfClasses(classes), `changes the fields and method signatures of ${classes.map(theClass => theClass.name).join(", ")} to those of the model${this.describeMembersFixedApart(classes)}`, [file]));
  }

  describeMembersFixedApart(classes) {
    const fixedApart = classes.flatMap(theClass => this.listExistingDefectsOf(theClass).map(existingDefect => `${theClass.name}#${existingDefect.member}, which group ${existingDefect.group} fixes`));
    return fixedApart.length ? `, except ${joinNames(fixedApart)}` : "";
  }

  listExistingDefectSteps() {
    return this.existingDefects.map(existingDefect => {
      const theClass = this.model.findClass(existingDefect.class);
      return this.createStep(MIGRATION_STAGES.CHANGED_MEMBERS, existingDefect.group, `fixes ${existingDefect.member} of ${existingDefect.class}: ${existingDefect.fix}`, theClass ? [theClass.file] : []);
    });
  }

  readCurrentFileOf(file) {
    const child = this.model.findChildOfTheFile(file);
    return child && isAText(child.oldPath) ? child.oldPath : file;
  }

  isASignatureChange(file, method) {
    if (!this.currentTree) return false;
    const currentFile = this.readCurrentFileOf(file);
    if (this.currentTree.readFileText(currentFile) === null) return false;
    return !this.currentTree.holdsTheSignature(currentFile, method);
  }

  isAChangedMethod(method, file) {
    if (isMarkedUnchanged(method)) return false;
    return isAText(method.body) || isAText(method.oldName) || this.isASignatureChange(file, method);
  }

  readCalledFiles(file) {
    const calledFiles = new Set();
    for (const theClass of this.listClassesOfTheFile(file)) {
      for (const method of readList(theClass.methods)) {
        for (const called of readList(method.calls)) {
          const calledClass = this.model.findClass(called);
          if (calledClass && calledClass.file !== file) calledFiles.add(calledClass.file);
        }
      }
    }
    return calledFiles;
  }

  orderFilesCalledFirst(files) {
    const orderedFiles = [];
    const visited = new Set();
    const visit = file => {
      if (visited.has(file)) return;
      visited.add(file);
      for (const calledFile of this.readCalledFiles(file)) {
        if (files.includes(calledFile)) visit(calledFile);
      }
      orderedFiles.push(file);
    };
    for (const file of files) visit(file);
    return orderedFiles;
  }

  listBodySteps() {
    const changedMethodsOfFileMap = new Map();
    for (const theClass of this.model.classes) {
      if (isAnInterface(theClass) || !this.model.isChangedClass(theClass) || this.createdFiles.has(theClass.file)) continue;
      for (const method of readList(theClass.methods)) {
        if (!this.isAChangedMethod(method, theClass.file) || this.isFixedApart(theClass, method.name)) continue;
        const changedMethods = changedMethodsOfFileMap.get(theClass.file) || [];
        changedMethods.push({ theClass, method });
        changedMethodsOfFileMap.set(theClass.file, changedMethods);
      }
    }
    return this.orderFilesCalledFirst([...changedMethodsOfFileMap.keys()]).map(file => {
      const methods = changedMethodsOfFileMap.get(file);
      const displayNames = methods.map(({ theClass, method }) => this.model.getMethodDisplayName(theClass, method));
      const givenBodies = methods.filter(({ method }) => isAText(method.body)).map(({ theClass, method }) => this.model.getMethodDisplayName(theClass, method));
      const given = givenBodies.length ? `, with the bodies the model gives for ${givenBodies.join(", ")}` : "";
      return this.createStep(MIGRATION_STAGES.BODIES, this.getGroupOfClasses(methods.map(({ theClass }) => theClass)), `writes the bodies of ${displayNames.join(", ")}${given}`, [file]);
    });
  }

  listRemovalSteps() {
    const steps = [];
    for (const theClass of this.model.classes) {
      if (readList(theClass.removed).length) steps.push(this.createStep(MIGRATION_STAGES.REMOVALS, getGroupOfTheClass(theClass), `removes ${readList(theClass.removed).join(", ")} from ${theClass.name}, once no caller uses them`, [theClass.file]));
    }
    for (const { child, file } of this.children) {
      if (readList(child.removedClasses).length) steps.push(this.createStep(MIGRATION_STAGES.REMOVALS, this.getGroupOfTheFile(file), `removes the classes ${readList(child.removedClasses).join(", ")} from ${file}`, [file]));
      if (child.kind === KINDS.REMOVED && !this.createdFileOfRemovedFileMap.has(file)) steps.push(this.createStep(MIGRATION_STAGES.REMOVALS, this.getGroupOfTheFile(file, this.lastGroup), `removes the file ${file}`, [file]));
    }
    for (const folder of this.model.folders) {
      if (folder.kind === KINDS.REMOVED) steps.push(this.createStep(MIGRATION_STAGES.REMOVALS, this.lastGroup, `removes the folder ${getFolderPath(folder)}/`, [`${getFolderPath(folder)}/`]));
    }
    return steps;
  }

  getGroupOfTheName(displayName) {
    const theClass = this.model.findClass(displayName);
    return theClass ? getGroupOfTheClass(theClass) : FIRST_GROUP;
  }

  listNamesOnThePath(startName) {
    const seenNames = new Set([this.model.normalizeName(startName)]);
    const namesToVisit = [...seenNames];
    while (namesToVisit.length) {
      const name = namesToVisit.pop();
      const method = this.model.findMethod(name);
      if (!method) continue;
      for (const reachedName of this.model.listNamesReachedFrom(this.model.findClass(name), method)) {
        if (seenNames.has(reachedName)) continue;
        seenNames.add(reachedName);
        namesToVisit.push(reachedName);
      }
    }
    return seenNames;
  }

  listClassesOnThePath(entryName) {
    return [...this.listNamesOnThePath(entryName)].map(name => this.model.findClass(name)).filter(Boolean);
  }

  // An integration test runs the whole path of its entry, so it waits for the last group that writes a class on that path.
  getGroupOfTheEntryPath(entryName) {
    return Math.max(FIRST_GROUP, ...this.listClassesOnThePath(entryName).map(getGroupOfTheClass));
  }

  changesTheMethodSignature(currentFile, method) {
    if (!isAPublicMethod(method) || isMarkedUnchanged(method)) return false;
    if (isAText(method.oldName)) return true;
    if (!this.currentTree) return false;
    return this.currentTree.listParameterTextsOf(currentFile, method.name).length > 0 && !this.currentTree.holdsTheSignature(currentFile, method);
  }

  // A modified class whose public signature, its constructor included, changes breaks the tests that construct or call it; a field the current file does not hold is a new constructor parameter.
  changesThePublicSignature(theClass) {
    if (isAText(theClass.oldName) || readList(theClass.removed).length) return true;

    const currentFile = this.readCurrentFileOf(theClass.file);
    const isInTheCurrentFile = this.currentTree && this.currentTree.holdsTheWord(currentFile, readLastNamePiece(theClass.name));
    if (this.currentTree && !isInTheCurrentFile) return false;
    if (readList(theClass.methods).some(method => this.changesTheMethodSignature(currentFile, method))) return true;
    return Boolean(isInTheCurrentFile) && readList(theClass.fields).some(field => !this.currentTree.holdsTheWord(currentFile, field.name));
  }

  isSearchedForTests(theClass) {
    return this.currentTree !== null && isAReadExtension(theClass.file);
  }

  listTestFilesThatName(theClass) {
    if (!this.isSearchedForTests(theClass)) return [];
    const className = readLastNamePiece(theClass.oldName || theClass.name);
    return this.currentTree.listFilesThatReferToTheClass([className], className, this.readCurrentFileOf(theClass.file))
      .filter(file => isATestFile(file) && isAReadExtension(file) && !this.createdFiles.has(file) && !this.removedFiles.has(file));
  }

  listTestUpdateSteps() {
    return this.model.classes
      .filter(theClass => this.model.getKindOfClass(theClass) === KINDS.MODIFIED && isAText(theClass.file) && !isATestFile(theClass.file) && this.changesThePublicSignature(theClass))
      .flatMap(theClass => {
        const testFiles = this.listTestFilesThatName(theClass);
        if (this.isSearchedForTests(theClass) && !testFiles.length) return [];
        const found = testFiles.length ? joinNames(testFiles) : TESTS_NOT_FOUND;
        return [this.createStep(MIGRATION_STAGES.TESTS, getGroupOfTheClass(theClass), `updates or removes the tests that construct or call ${this.model.getClassDisplayName(theClass)}: ${found}`, testFiles)];
      });
  }

  // An exit is a new outside call where its class is created by the change, or where the current file of its class does not hold its method.
  isANewOutsideCall(exitName) {
    const exitClass = this.model.findClass(exitName);
    if (!exitClass) return false;
    if (this.model.getKindOfClass(exitClass) === KINDS.CREATED) return true;
    const methodName = exitName.slice(exitName.lastIndexOf("#") + 1);
    return this.currentTree !== null && !this.currentTree.holdsTheWord(this.readCurrentFileOf(exitClass.file), methodName);
  }

  listNewOutsideCallNames() {
    return [...new Set(readList(this.model.decisions.exits).map(exit => exit.exit).filter(isAText).map(exitName => this.model.normalizeName(exitName)))]
      .filter(exitName => this.isANewOutsideCall(exitName));
  }

  listNamesReachedFromTheClass(theClass) {
    return new Set(readList(theClass.methods).filter(isAPublicMethod).flatMap(method => [...this.listNamesOnThePath(this.model.getMethodDisplayName(theClass, method))]));
  }

  listNewOutsideInterfacesReachedFrom(useCase, newOutsideCallNames) {
    const reachedNames = this.listNamesReachedFromTheClass(useCase);
    const reachedClasses = newOutsideCallNames.filter(exitName => reachedNames.has(exitName)).map(exitName => this.model.findClass(exitName)).filter(exitClass => exitClass !== useCase);
    return [...new Set(reachedClasses)];
  }

  listEntriesThatReach(useCase) {
    const useCaseNames = readList(useCase.methods).filter(isAPublicMethod).map(method => this.model.getMethodDisplayName(useCase, method));
    return readList(this.model.decisions.entries).map(entry => entry.entry).filter(isAText)
      .filter(entryName => {
        const reachedNames = this.listNamesOnThePath(entryName);
        return useCaseNames.some(useCaseName => reachedNames.has(useCaseName));
      });
  }

  // A test that runs an entry by its route or its message names no class, so the step names the entries whose tests the writer finds by hand.
  describeTestsNotFoundThrough(useCase) {
    if (!this.isSearchedForTests(useCase)) return TESTS_NOT_FOUND;
    const entryNames = this.listEntriesThatReach(useCase);
    const entryWords = entryNames.length ? `; find the tests of ${joinNames(entryNames)} by hand` : "";
    return `no test file names it or a caller of it${entryWords}`;
  }

  // The tests that call the use case: those that name it, and those that name a class of the model whose path reaches it, such as the controller of its entry.
  listTestFilesThatReach(useCase) {
    const useCaseNames = readList(useCase.methods).filter(isAPublicMethod).map(method => this.model.getMethodDisplayName(useCase, method));
    const callers = this.model.classes.filter(theClass => theClass !== useCase && !isATestFile(theClass.file || "") && this.model.getKindOfClass(theClass) !== KINDS.CREATED)
      .filter(theClass => {
        const reachedNames = this.listNamesReachedFromTheClass(theClass);
        return useCaseNames.some(useCaseName => reachedNames.has(useCaseName));
      });
    return [...new Set([useCase, ...callers].flatMap(theClass => this.listTestFilesThatName(theClass)))];
  }

  // A modified class whose path now reaches a new outside call breaks the tests that run it with no substitute for that call, also where its signature stays.
  listNewOutsideCallTestSteps() {
    const newOutsideCallNames = this.listNewOutsideCallNames();
    if (!newOutsideCallNames.length) return [];

    return this.model.classes
      .filter(theClass => this.model.getKindOfClass(theClass) === KINDS.MODIFIED && isAText(theClass.file) && !isATestFile(theClass.file))
      .flatMap(useCase => {
        const outsideInterfaces = this.listNewOutsideInterfacesReachedFrom(useCase, newOutsideCallNames);
        if (!outsideInterfaces.length) return [];
        const testFiles = this.listTestFilesThatReach(useCase);
        const found = testFiles.length ? joinNames(testFiles) : this.describeTestsNotFoundThrough(useCase);
        const interfaceNames = joinNames(outsideInterfaces.map(outsideInterface => this.model.getClassDisplayName(outsideInterface)));
        return [this.createStep(MIGRATION_STAGES.TESTS, getGroupOfTheClass(useCase), `updates the tests that reach ${interfaceNames} through ${this.model.getClassDisplayName(useCase)}: ${found}`, testFiles)];
      });
  }

  listTestSteps() {
    const tests = this.model.decisions.tests || {};
    const unitTestSteps = readList(tests.unit).map(unitTest => this.createStep(MIGRATION_STAGES.TESTS, this.getGroupOfTheName(unitTest.class), `writes the unit tests of ${unitTest.class}: ${readList(unitTest.tests).join(", ")}`, [unitTest.file]));
    const integrationSteps = readList(tests.integration).map(integration => this.createStep(MIGRATION_STAGES.TESTS, this.getGroupOfTheEntryPath(integration.entry), `writes the integration tests of ${integration.entry}: ${readList(integration.tests).join(", ")}`, [integration.file]));
    return [...this.listTestUpdateSteps(), ...this.listNewOutsideCallTestSteps(), ...unitTestSteps, ...integrationSteps];
  }

  // A modified file in no language the scripts read and with no class of the model, such as the XML wiring of a framework, gets 1 step that the writer does by hand.
  listNotModelledSteps() {
    return this.children
      .filter(({ child, file }) => child.kind === KINDS.MODIFIED && path.posix.extname(file) && !isAReadExtension(file) && !this.listClassesOfTheFile(file).length)
      .map(({ folder, file }) => {
        const folderPath = `${getFolderPath(folder)}/`;
        const group = this.getGroupOfClasses(this.model.classes.filter(theClass => isAText(theClass.file) && theClass.file.startsWith(folderPath)));
        return this.createStep(MIGRATION_STAGES.BODIES, group, `not modelled: edit ${file} by hand (framework wiring)`, [file]);
      });
  }

  listSteps() {
    const steps = [
      ...this.listFolderSteps(),
      ...this.listMoveSteps(),
      ...this.listRenameSteps(),
      ...this.listCreatedClassSteps(),
      ...this.listChangedMemberSteps(),
      ...this.listExistingDefectSteps(),
      ...this.listBodySteps(),
      ...this.listNotModelledSteps(),
      ...this.listRemovalSteps(),
      ...this.listTestSteps(),
    ];
    const readRank = step => STAGE_ORDER.indexOf(step.rank || step.stage);
    const existingDefectGroups = new Set(this.existingDefects.map(existingDefect => existingDefect.group));
    return steps
      .sort((first, second) => first.group - second.group || readRank(first) - readRank(second))
      .map(({ rank, ...step }, at) => ({ number: at + 1, ...step, existingDefect: existingDefectGroups.has(step.group) }));
  }
}

export const listMigrationSteps = (model, currentTree = null) => new MigrationPlan(model, currentTree).listSteps();
