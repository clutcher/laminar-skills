import path from "node:path";
import { KINDS, getFileOfTheChild, getFolderPath, isAText, isAnInterface, isLeftUnfixed, isMarkedUnchanged, readList, readOldTypeName, readTypeNames } from "../model/DesignModel.mjs";
import { isAReadExtension, isATestFile } from "../model/SourceLanguages.mjs";
import { IntegrationTestPlacement } from "./IntegrationTestPlacement.mjs";

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

// A nested type stands in a file by every piece of its dotted name, and a file refers to it through its outermost type.
const readTypeSearch = typeName => {
  const pieces = typeName.split(".");
  return { words: pieces, referredName: pieces[0] };
};

// The name a class has in the current tree, which a rename by oldName still holds.
const readCurrentTypeName = theClass => readOldTypeName(theClass) || theClass.name;

// The word of a member that a body of the model reads, as a field or a call on a value.
const readsTheMember = (method, memberName) => isAText(method.body) && new RegExp(`\\.${memberName.replace(/[$]/g, "\\$")}([^\\w$]|$)`).test(method.body);

const getGroupOfTheClass = theClass => (Number.isFinite(theClass.group) ? theClass.group : FIRST_GROUP);

const readPathOfTheChild = file => file.replace(/\/+$/, "");

const namesTheRenamedMember = (existingDefect, member) => existingDefect.member === member.oldName || existingDefect.member === member.name;

class MigrationPlan {
  constructor(model, currentTree) {
    this.model = model;
    this.currentTree = currentTree;
    const allChildren = model.folders.flatMap(folder => readList(folder.children).map(child => ({ folder, child, file: getFileOfTheChild(folder, child) })));
    this.children = allChildren.filter(({ file }) => !model.isAFolderChild(readPathOfTheChild(file)));
    // A folder child that no folder of the model lists takes its step from its own kind, because no folder step names it.
    const listedFolderPaths = new Set(model.folders.map(getFolderPath));
    this.unlistedFolderChildren = allChildren
      .filter(({ file }) => model.isAFolderChild(readPathOfTheChild(file)) && !listedFolderPaths.has(readPathOfTheChild(file)))
      .map(folderChild => ({ ...folderChild, folderPath: `${readPathOfTheChild(folderChild.file)}/` }));
    this.createdFiles = new Set(this.children.filter(({ child }) => child.kind === KINDS.CREATED).map(({ file }) => file));
    this.newFileOfOldPathMap = new Map(this.children.filter(({ child }) => child.kind === KINDS.MOVED && isAText(child.oldPath)).map(({ child, file }) => [child.oldPath, file]));
    this.removedFiles = new Set(this.children.filter(({ child }) => child.kind === KINDS.REMOVED).map(({ file }) => file));
    this.createdFileOfRemovedFileMap = new Map(this.children
      .filter(({ child }) => child.kind === KINDS.CREATED && isAText(child.oldPath) && this.removedFiles.has(child.oldPath))
      .map(({ child, file }) => [child.oldPath, file]));
    this.lastGroup = Math.max(FIRST_GROUP, ...model.classes.map(getGroupOfTheClass));
    this.existingDefects = readList(model.decisions.existingDefects).filter(existingDefect => Number.isFinite(existingDefect.group) && !isLeftUnfixed(existingDefect));
    this.integrationTestPlacement = new IntegrationTestPlacement(model, currentTree, removedFile => this.getGroupOfTheRemoval(removedFile));
  }

  listExistingDefectsOf(theClass) {
    return this.existingDefects.filter(existingDefect => this.model.findClass(existingDefect.class) === theClass);
  }

  isFixedApart(theClass, memberName) {
    return this.listExistingDefectsOf(theClass).some(existingDefect => existingDefect.member === memberName);
  }

  // A member renamed by oldName whose existing defect the model fixes in its own group is renamed in that group, so the rename stands once.
  getGroupOfTheMemberRename(theClass, member) {
    const existingDefect = this.listExistingDefectsOf(theClass).find(fixedDefect => namesTheRenamedMember(fixedDefect, member));
    return existingDefect ? existingDefect.group : getGroupOfTheClass(theClass);
  }

  isFixedByARename(existingDefect) {
    const theClass = this.model.findClass(existingDefect.class);
    if (!theClass) return false;

    return [...readList(theClass.methods), ...readList(theClass.fields)].some(member => isAText(member.oldName) && namesTheRenamedMember(existingDefect, member));
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

  // A file that a later group removes still exists at the end of the group of the move, so its imports change in that group.
  listImportingFiles(className, oldFile, newFile, groupOfTheChange) {
    if (!this.currentTree) return [];

    const oldFolder = isAText(oldFile) ? path.posix.dirname(oldFile) : null;
    const leavesItsFolder = oldFolder !== null && oldFolder !== path.posix.dirname(newFile);
    const sameFolderFiles = leavesItsFolder ? this.currentTree.listFilesThatHoldEveryWord([className]).filter(file => path.posix.dirname(file) === oldFolder) : [];
    const importingFiles = [...this.currentTree.listFilesThatImportTheClass(className, oldFile), ...sameFolderFiles]
      .map(file => this.newFileOfOldPathMap.get(file) || file)
      .filter(file => file !== oldFile && file !== newFile && !this.createdFiles.has(file) && (!this.removedFiles.has(file) || this.getGroupOfTheRemoval(file) > groupOfTheChange));
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

  // A class of the model reads a member of theClass where its body reads the member, its calls name it, or it implements or extends theClass.
  isAReaderOfTheMember(other, theClass, memberName) {
    if (other === theClass) return false;

    return this.model.implementsOrExtends(other, theClass)
      || this.readsTheMemberInABody(other, theClass, memberName)
      || this.callsAny(other, (calledClass, called) => calledClass === theClass && called.endsWith(`#${memberName}`));
  }

  // A body names a member by its word alone, so where a parent of theClass declares the member too, the body reads it on theClass only where its class also refers to theClass; otherwise it reads the member of the parent.
  readsTheMemberInABody(other, theClass, memberName) {
    if (!readList(other.methods).some(method => readsTheMember(method, memberName))) return false;

    return !this.inheritsTheMember(theClass, memberName) || this.refersToTheClass(other, theClass);
  }

  inheritsTheMember(theClass, memberName) {
    return this.model.classes
      .filter(parent => parent !== theClass && this.model.implementsOrExtends(theClass, parent))
      .some(parent => [...readList(parent.methods), ...readList(parent.fields)].some(member => member.name === memberName || member.oldName === memberName));
  }

  // A class refers to theClass where its calls or field types name it, as a construction or a member the parent lacks, or where a parameter type or a body of its methods names it.
  refersToTheClass(other, theClass) {
    const namesTheType = typeText => readTypeNames(typeText).some(typeName => this.model.findClassOfTheType(typeName, other) === theClass);
    const classWord = new RegExp(`(^|[^\\w$])${theClass.name.replace(/[$]/g, "\\$")}([^\\w$]|$)`);
    return this.namesTheClass(other, theClass)
      || readList(other.methods).some(method => readList(method.parameters).some(parameter => namesTheType(parameter.type)) || (isAText(method.body) && classWord.test(method.body)));
  }

  // The group of the step that removes a file of the model: the group of the class created from it, or else the group of its own classes.
  getGroupOfTheRemoval(removedFile) {
    const createdFile = this.createdFileOfRemovedFileMap.get(removedFile);
    return createdFile ? this.getGroupOfTheFile(createdFile) : this.getGroupOfTheFile(removedFile, this.lastGroup);
  }

  // The reader files of a member of the class: in the tree, each file that names the class and the member by its current name; in the model, the file of each class that reads it. A file that a later group removes still exists at the end of the group of the change, so it stays a reader file.
  listReaderFiles(theClass, memberName, groupOfTheChange, currentMemberName = memberName) {
    const { words, referredName } = readTypeSearch(readCurrentTypeName(theClass));
    return this.listCallerFiles([...words, currentMemberName], other => this.isAReaderOfTheMember(other, theClass, memberName), referredName, this.readCurrentFileOf(theClass.file))
      .filter(file => file !== theClass.file && this.standsAfterTheGroup(file, groupOfTheChange));
  }

  standsAfterTheGroup(file, groupOfTheChange) {
    return !this.removedFiles.has(file) || this.getGroupOfTheRemoval(file) > groupOfTheChange;
  }

  // The files that call the constructor of the class: in the tree, each file that refers to the class and calls its name; in the model, the file of each class whose calls name the class alone.
  listConstructorCallerFiles(theClass, groupOfTheChange) {
    const currentName = readCurrentTypeName(theClass);
    const { words, referredName } = readTypeSearch(currentName);
    const callsTheConstructor = file => this.currentTree.holdsACallOf(file, readLastNamePiece(currentName));
    const callsTheClassAlone = other => other !== theClass && this.callsAny(other, (calledClass, called) => calledClass === theClass && !called.includes("#"));
    const treeFiles = this.currentTree ? this.currentTree.listFilesThatReferToTheClass(words, referredName, this.readCurrentFileOf(theClass.file)).filter(callsTheConstructor).map(file => this.newFileOfOldPathMap.get(file) || file) : [];
    return [...treeFiles, ...this.listFilesOfTheModelThat(callsTheClassAlone)]
      .filter(file => file !== theClass.file && !this.createdFiles.has(file) && this.standsAfterTheGroup(file, groupOfTheChange));
  }

  describeReaderFile(readerFile) {
    return this.removedFiles.has(readerFile) ? `${readerFile}, which group ${this.getGroupOfTheRemoval(readerFile)} removes` : readerFile;
  }

  describeReaderUpdate(readerFiles) {
    return readerFiles.length ? `; updates the files that read it: ${joinNames(readerFiles.map(readerFile => this.describeReaderFile(readerFile)))}` : "";
  }

  // The group of a changed class of the model in the file that stands later than the group of the change; null where none does.
  findLaterGroupOfTheFile(file, groupOfTheChange) {
    const laterGroups = this.listClassesOfTheFile(file)
      .filter(theClass => this.model.isChangedClass(theClass))
      .map(getGroupOfTheClass)
      .filter(group => group > groupOfTheChange);
    return laterGroups.length ? Math.min(...laterGroups) : null;
  }

  // A file whose class a later group changes gets only the lines that the new signature breaks in the group of the change, so the group builds and the rest waits for its own group.
  describeLaterGroupFile(file, groupOfTheChange) {
    const laterGroup = this.findLaterGroupOfTheFile(file, groupOfTheChange);
    return laterGroup === null ? "" : ` (change only the lines that the new signature breaks; the rest of this class is group ${laterGroup})`;
  }

  describeSignatureReaderFiles(readerFiles, groupOfTheChange) {
    return joinNames(readerFiles.map(readerFile => `${this.describeReaderFile(readerFile)}${this.describeLaterGroupFile(readerFile, groupOfTheChange)}`));
  }

  describeSignatureReaderUpdate(readerFiles, groupOfTheChange) {
    return readerFiles.length ? `; updates the files that read it: ${this.describeSignatureReaderFiles(readerFiles, groupOfTheChange)}` : "";
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
      const group = this.getGroupOfClasses(classes);
      const verb = path.posix.basename(child.oldPath) === child.name ? "moves" : "renames and moves";
      const callerFiles = classes.flatMap(movedClass => this.listCallerFiles([movedClass.name], theClass => theClass !== movedClass && this.namesTheClass(theClass, movedClass), movedClass.oldName || movedClass.name, child.oldPath));
      const importingFiles = [...new Set(classes.flatMap(movedClass => this.listImportingFiles(movedClass.oldName || movedClass.name, child.oldPath, file, group)))];
      const says = `${verb} ${child.oldPath} to ${file}, with no change of behavior${this.describeImportUpdate(importingFiles)}`;
      return this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, group, says, [child.oldPath, file, ...callerFiles.filter(callerFile => callerFile !== file), ...importingFiles]);
    });
  }

  listRenameSteps() {
    const steps = [];
    for (const theClass of this.model.classes) {
      const group = getGroupOfTheClass(theClass);
      const { words, referredName } = readTypeSearch(readCurrentTypeName(theClass));
      if (isAText(theClass.oldName)) {
        const oldTypeName = readOldTypeName(theClass);
        const callerFiles = this.listCallerFiles(words, other => other !== theClass && this.namesTheClass(other, theClass), referredName, this.readCurrentFileOf(theClass.file));
        const importingFiles = oldTypeName.includes(".") ? [] : this.listImportingFiles(theClass.oldName, theClass.file, theClass.file, group);
        steps.push(this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, group, `renames the class ${oldTypeName} to ${theClass.name}, with no change of behavior${this.describeImportUpdate(importingFiles)}`, [theClass.file, ...callerFiles, ...importingFiles]));
      }
      for (const method of readList(theClass.methods)) {
        if (isAText(method.oldName)) steps.push(this.createMethodRenameStep(theClass, method, this.getGroupOfTheMemberRename(theClass, method)));
      }
      // A renamed field is a changed public member: the step updates each reader file in the group of the rename, so the group builds alone.
      for (const field of readList(theClass.fields)) {
        if (!isAText(field.oldName)) continue;
        const groupOfTheRename = this.getGroupOfTheMemberRename(theClass, field);
        const readerFiles = this.listReaderFiles(theClass, field.oldName, groupOfTheRename);
        steps.push(this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, groupOfTheRename, `renames ${this.model.getClassDisplayName(theClass)}#${field.oldName} to ${field.name}, with no change of behavior${this.describeReaderUpdate(readerFiles)}`, [theClass.file, ...readerFiles]));
      }
    }
    return steps;
  }

  // A renamed method changes its signature too where the current file declares it under the old name with other parameter types or another return type; a new parameter name alone changes no signature, and a file that holds no declaration the script reads keeps the plain rename.
  changesTheSignatureOfTheRename(theClass, method) {
    if (!this.currentTree) return false;

    const currentFile = this.readCurrentFileOf(theClass.file);
    return this.currentTree.listParameterTextsOf(currentFile, method.oldName).length > 0
      && !this.currentTree.holdsTheTypesOfTheSignature(currentFile, { ...method, name: method.oldName });
  }

  // The earliest group whose rename with a signature change of the same method, in a class that theClass implements or extends, already changed the lines of theClass that the new signature breaks; null where no earlier group did.
  findGroupThatCarriedTheRename(theClass, method) {
    const groupOfTheClass = getGroupOfTheClass(theClass);
    const carryingGroups = this.model.classes
      .filter(parent => getGroupOfTheClass(parent) < groupOfTheClass && this.model.implementsOrExtends(theClass, parent))
      .filter(parent => readList(parent.methods).some(parentMethod => parentMethod.oldName === method.oldName && parentMethod.name === method.name && this.changesTheSignatureOfTheRename(parent, parentMethod)))
      .map(getGroupOfTheClass);
    return carryingGroups.length ? Math.min(...carryingGroups) : null;
  }

  describeCarriedRename(theClass, method) {
    const carryingGroup = this.findGroupThatCarriedTheRename(theClass, method);
    return carryingGroup === null ? "" : `; group ${carryingGroup} already changed the lines that the new signature breaks`;
  }

  // A rename whose signature changes too breaks each reader file, its callers, implementers and test substitutes, so the step carries the new signature to them in its own group.
  createMethodRenameStep(theClass, method, group) {
    const renames = `renames ${this.model.getClassDisplayName(theClass)}#${method.oldName} to ${method.name}`;
    const carried = this.describeCarriedRename(theClass, method);
    if (this.changesTheSignatureOfTheRename(theClass, method)) {
      const readerFiles = [...new Set(this.listReaderFiles(theClass, method.name, group, method.oldName))];
      return this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, group, `${renames} and changes its signature to that of the model${carried}${this.describeSignatureReaderUpdate(readerFiles, group)}`, [theClass.file, ...readerFiles]);
    }

    const { words, referredName } = readTypeSearch(readCurrentTypeName(theClass));
    const callerFiles = this.listCallerFiles([...words, method.oldName], other => this.isAReaderOfTheMember(other, theClass, method.name), referredName, this.readCurrentFileOf(theClass.file));
    return this.createStep(MIGRATION_STAGES.MOVES_AND_RENAMES, group, `${renames}, with no change of behavior${carried}`, [theClass.file, ...callerFiles]);
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
      const importingFiles = isAText(child.oldPath) ? [...new Set(this.listClassesOfTheFile(file).flatMap(theClass => this.listImportingFiles(theClass.oldName || theClass.name, child.oldPath, file, group)))] : [];
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
      .map(({ file, classes }) => {
        const group = this.getGroupOfClasses(classes);
        const callerFiles = [...new Set(classes.flatMap(theClass => this.listCallersOfChangedSignatures(theClass, group)))];
        const callers = callerFiles.length ? `; updates the callers of the changed signatures in ${this.describeSignatureReaderFiles(callerFiles, group)}` : "";
        const fieldUserFiles = [...new Set(classes.flatMap(theClass => this.listProductionUsersOfRetypedFields(theClass, group)))].filter(fieldUserFile => !callerFiles.includes(fieldUserFile));
        const fieldUsers = fieldUserFiles.length ? `; updates the production files that construct the class or read a retyped field in ${this.describeSignatureReaderFiles(fieldUserFiles, group)}` : "";
        return this.createStep(MIGRATION_STAGES.CHANGED_MEMBERS, group, `changes the fields and method signatures of ${classes.map(theClass => theClass.name).join(", ")} to those of the model${this.describeMembersFixedApart(classes)}${callers}${fieldUsers}`, [file, ...callerFiles, ...fieldUserFiles]);
      });
  }

  // A public method whose signature or return type changes with no rename breaks its callers and implementers, so the step of the change updates them in its own group.
  listCallersOfChangedSignatures(theClass, groupOfTheChange) {
    const currentFile = this.readCurrentFileOf(theClass.file);
    return readList(theClass.methods)
      .filter(method => !isAText(method.oldName) && this.changesTheMethodSignature(currentFile, method))
      .flatMap(method => this.listReaderFiles(theClass, method.name, groupOfTheChange));
  }

  // A field that keeps its name and changes its type, with no rename: the current file holds its name, but no line of it holds the type of the model beside the name.
  listRetypedFields(theClass) {
    if (!this.currentTree) return [];
    const currentFile = this.readCurrentFileOf(theClass.file);
    return readList(theClass.fields)
      .filter(field => !isAText(field.oldName) && isAText(field.type) && this.currentTree.holdsTheWord(currentFile, field.name) && !this.currentTree.holdsTheTypeBesideTheName(currentFile, field));
  }

  // A retyped field breaks each production file that constructs the class, as a record component does, or reads the field; its tests stand in the test step of the class.
  listProductionUsersOfRetypedFields(theClass, groupOfTheChange) {
    const retypedFields = this.listRetypedFields(theClass);
    if (!retypedFields.length) return [];

    const readerFiles = retypedFields.flatMap(field => this.listReaderFiles(theClass, field.name, groupOfTheChange));
    return [...this.listConstructorCallerFiles(theClass, groupOfTheChange), ...readerFiles].filter(file => !isATestFile(file));
  }

  describeMembersFixedApart(classes) {
    const fixedApart = classes.flatMap(theClass => this.listExistingDefectsOf(theClass).map(existingDefect => `${theClass.name}#${existingDefect.member}, which group ${existingDefect.group} fixes`));
    return fixedApart.length ? `, except ${joinNames(fixedApart)}` : "";
  }

  // An existing defect whose fix is a rename by oldName gets no step of its own, because the rename step stands in its group.
  listExistingDefectSteps() {
    return this.existingDefects.filter(existingDefect => !this.isFixedByARename(existingDefect)).map(existingDefect => {
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
      if (!readList(theClass.removed).length) continue;
      // A removed public member breaks each reader file, so the step of the removal updates them in its own group.
      const readerFiles = [...new Set(readList(theClass.removed).flatMap(removedName => this.listReaderFiles(theClass, removedName, getGroupOfTheClass(theClass))))];
      steps.push(this.createStep(MIGRATION_STAGES.REMOVALS, getGroupOfTheClass(theClass), `removes ${readList(theClass.removed).join(", ")} from ${theClass.name}, once no caller uses them${this.describeReaderUpdate(readerFiles)}`, [theClass.file, ...readerFiles]));
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

  // A removed class takes its check away in the group that removes it, as in the steps that update the tests of a removed class.
  getGroupOfTheRemovedTest(className) {
    const removingFile = this.model.findFileThatRemovesTheClass(className);
    if (removingFile) return this.getGroupOfTheFile(removingFile);

    const theClass = this.model.findClass(className);
    return theClass && this.model.isRemovedClass(theClass) ? this.getGroupOfTheRemoval(theClass.file) : this.getGroupOfTheName(className);
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

  changesTheMethodSignature(currentFile, method) {
    if (!isAPublicMethod(method) || isMarkedUnchanged(method)) return false;
    if (isAText(method.oldName)) return true;
    if (!this.currentTree) return false;
    return this.currentTree.listParameterTextsOf(currentFile, method.name).length > 0 && !this.currentTree.holdsTheSignature(currentFile, method);
  }

  // A modified class whose public signature, its constructor included, changes breaks the tests that construct or call it; a field the current file does not hold is a new constructor parameter, and a retyped field changes the type of one.
  changesThePublicSignature(theClass) {
    if (isAText(theClass.oldName) || readList(theClass.removed).length || readList(theClass.fields).some(field => isAText(field.oldName))) return true;

    const currentFile = this.readCurrentFileOf(theClass.file);
    const isInTheCurrentFile = this.currentTree && this.currentTree.holdsTheWord(currentFile, readLastNamePiece(readCurrentTypeName(theClass)));
    if (this.currentTree && !isInTheCurrentFile) return false;
    if (readList(theClass.methods).some(method => this.changesTheMethodSignature(currentFile, method))) return true;
    if (!isInTheCurrentFile) return false;

    return readList(theClass.fields).some(field => !this.currentTree.holdsTheWord(currentFile, field.name)) || this.listRetypedFields(theClass).length > 0;
  }

  isSearchedForTests(theClass) {
    return this.currentTree !== null && isAReadExtension(theClass.file);
  }

  // A test file that a later group removes still exists at the end of the group of the change, so it is still a test to update.
  listTestFilesThatName(theClass, groupOfTheChange = getGroupOfTheClass(theClass)) {
    if (!this.isSearchedForTests(theClass)) return [];
    const { words, referredName } = readTypeSearch(readCurrentTypeName(theClass));
    return this.currentTree.listFilesThatReferToTheClass(words, referredName, this.readCurrentFileOf(theClass.file))
      .filter(file => isATestFile(file) && isAReadExtension(file) && !this.createdFiles.has(file) && (!this.removedFiles.has(file) || this.getGroupOfTheRemoval(file) > groupOfTheChange));
  }

  // The group of the step of decisions.tests that writes the test file, where a later group than the given one writes it.
  findLaterGroupThatWritesTheTests(testFile, group) {
    const tests = this.model.decisions.tests || {};
    const writingGroups = [
      ...readList(tests.unit).filter(unitTest => unitTest.file === testFile).map(unitTest => this.getGroupOfTheName(unitTest.class)),
      ...readList(tests.integration).filter(integration => integration.file === testFile).map(integration => this.integrationTestPlacement.getGroupOfTheTest(integration)),
    ].filter(writingGroup => writingGroup > group);
    return writingGroups.length ? Math.min(...writingGroups) : null;
  }

  describeTestFileOfTheRemoval(testFile, group) {
    const laterGroup = this.findLaterGroupThatWritesTheTests(testFile, group);
    return laterGroup === null ? testFile : `${testFile} (remove or change only the tests that read it; group ${laterGroup} writes the tests of this file)`;
  }

  // A removed class breaks each existing test that names it, so the group of the removal updates or removes those tests, also where a later group writes new tests into the same file.
  listRemovedClassTestSteps() {
    const removedFileClasses = this.children
      .filter(({ child }) => child.kind === KINDS.REMOVED)
      .flatMap(({ file }) => this.listClassesOfTheFile(file).map(theClass => ({ theClass, group: this.getGroupOfTheRemoval(file) })));
    const removedNestedClasses = this.children
      .flatMap(({ child, file }) => readList(child.removedClasses).map(className => ({ theClass: this.model.findClass(className), group: this.getGroupOfTheFile(file) })))
      .filter(({ theClass }) => theClass);
    return [...removedFileClasses, ...removedNestedClasses]
      .filter(({ theClass }) => !isATestFile(theClass.file))
      .flatMap(({ theClass, group }) => {
        const testFiles = this.listTestFilesThatName(theClass, group).filter(testFile => testFile !== theClass.file);
        if (!testFiles.length) return [];
        const found = joinNames(testFiles.map(testFile => this.describeTestFileOfTheRemoval(testFile, group)));
        return [{ ...this.createStep(MIGRATION_STAGES.TESTS, group, `updates or removes the tests that read ${this.model.getClassDisplayName(theClass)}, which this group removes: ${found}`, testFiles), testedFiles: [theClass.file] }];
      });
  }

  listTestUpdateSteps() {
    return this.model.classes
      .filter(theClass => this.model.getKindOfClass(theClass) === KINDS.MODIFIED && isAText(theClass.file) && !isATestFile(theClass.file) && this.changesThePublicSignature(theClass))
      .flatMap(theClass => {
        const testFiles = this.listTestFilesThatName(theClass);
        if (this.isSearchedForTests(theClass) && !testFiles.length) return [];
        const found = testFiles.length ? joinNames(testFiles.map(testFile => `${this.describeReaderFile(testFile)}${this.describeLaterGroupFile(testFile, getGroupOfTheClass(theClass))}`)) : TESTS_NOT_FOUND;
        return [{ ...this.createStep(MIGRATION_STAGES.TESTS, getGroupOfTheClass(theClass), `updates or removes the tests that construct or call ${this.model.getClassDisplayName(theClass)}: ${found}`, testFiles), testedFiles: [theClass.file] }];
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
        return [{ ...this.createStep(MIGRATION_STAGES.TESTS, getGroupOfTheClass(useCase), `updates the tests that reach ${interfaceNames} through ${this.model.getClassDisplayName(useCase)}: ${found}`, testFiles), testedFiles: [useCase.file] }];
      });
  }

  // A test of a check that the change removes or moves goes in the group of the class that removes the check, and it belongs to that class in a cut plan.
  createRemovedTestStep(removedTest) {
    const step = this.createStep(MIGRATION_STAGES.TESTS, this.getGroupOfTheRemovedTest(removedTest.class), `removes the test ${removedTest.test} of ${removedTest.file}: ${removedTest.why}`, [removedTest.file]);
    const theClass = this.model.findClass(removedTest.class);
    return theClass && isAText(theClass.file) ? { ...step, testedFiles: [theClass.file] } : step;
  }

  listTestSteps() {
    const tests = this.model.decisions.tests || {};
    const removedTestSteps = readList(tests.removed).map(removedTest => this.createRemovedTestStep(removedTest));
    const unitTestSteps = readList(tests.unit).map(unitTest => this.createStep(MIGRATION_STAGES.TESTS, this.getGroupOfTheName(unitTest.class), `writes the unit tests of ${unitTest.class}: ${readList(unitTest.tests).join(", ")}`, [unitTest.file]));
    const createTestStep = (group, says, files) => this.createStep(MIGRATION_STAGES.TESTS, group, says, files);
    const integrationSteps = readList(tests.integration).flatMap(integration => [
      this.integrationTestPlacement.createWriteStep(integration, createTestStep),
      ...this.integrationTestPlacement.createLaterSteps(integration, createTestStep),
    ]);
    return [...this.listTestUpdateSteps(), ...this.listRemovedClassTestSteps(), ...this.listNewOutsideCallTestSteps(), ...removedTestSteps, ...unitTestSteps, ...integrationSteps];
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
