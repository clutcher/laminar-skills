import { KINDS, isAText, isAnInterface, readList } from "../model/DesignModel.mjs";
import { isATestFile } from "../model/SourceLanguages.mjs";

const FIRST_GROUP = 1;

const KINDS_THAT_CHANGE_A_CLASS = new Set([KINDS.CREATED, KINDS.MOVED, KINDS.MODIFIED]);

const getGroupOfTheClass = theClass => (Number.isFinite(theClass.group) ? theClass.group : FIRST_GROUP);

const joinNames = names => names.join(", ");

// The migration group of each integration test of decisions.tests, and the implementations it runs against there. The test joins the first group at whose end its whole path exists: the path ends at an exit that a substitute of the test replaces, and at an interface of that group or an earlier one it follows only the implementations that exist in their final form at the end of that group, where at least 1 implementation exists there.
export class IntegrationTestPlacement {
  constructor(model, currentTree, getGroupOfTheRemoval) {
    this.model = model;
    this.currentTree = currentTree;
    this.getGroupOfTheRemoval = getGroupOfTheRemoval;
  }

  listImplementationsOf(interfaceClass) {
    return this.model.classes.filter(theClass => theClass !== interfaceClass && !isATestFile(theClass.file || "") && this.model.implementsOrExtends(theClass, interfaceClass));
  }

  // The old file of a class created from an old file, whose code the tree holds until the group of the class.
  findOldFileOf(theClass) {
    const child = this.model.findChildOfTheFile(theClass.file);
    return child && child.kind === KINDS.CREATED && isAText(child.oldPath) ? child.oldPath : null;
  }

  isInItsOldFileAtTheEndOf(theClass, group) {
    return this.findOldFileOf(theClass) !== null && getGroupOfTheClass(theClass) > group;
  }

  // A created class exists from its own group on, and before it in its old file where it takes its code from one; a class of a removed file exists until the group of its removal, and every other class from the start.
  existsAtTheEndOf(theClass, group) {
    const kind = this.model.getKindOfClass(theClass);
    if (kind === KINDS.CREATED) return getGroupOfTheClass(theClass) <= group || this.isInItsOldFileAtTheEndOf(theClass, group);
    if (kind === KINDS.REMOVED) return this.getGroupOfTheRemoval(theClass.file) > group;
    return true;
  }

  describeTheImplementationAt(implementation, group) {
    return this.isInItsOldFileAtTheEndOf(implementation, group) ? `the code of ${this.findOldFileOf(implementation)}` : this.model.getClassDisplayName(implementation);
  }

  listImplementationsAtTheEndOf(interfaceClass, group) {
    return this.listImplementationsOf(interfaceClass).filter(implementation => this.existsAtTheEndOf(implementation, group));
  }

  // At an interface of that group or an earlier one, the path follows only the implementations that the group writes or that the tree holds unchanged; it ends at an implementation that a later group changes or removes, which the test runs against in its current form, and it leaves out an implementation that a later group creates.
  findImplementationsToLeave(theClass, group) {
    if (group === null || !isAnInterface(theClass) || getGroupOfTheClass(theClass) > group) return [];
    if (!this.listImplementationsAtTheEndOf(theClass, group).length) return [];
    return this.listImplementationsOf(theClass).filter(implementation => getGroupOfTheClass(implementation) > group);
  }

  isASubstitutedExit(integration, theClass, name) {
    const substitutedNames = readList(integration.substitutes).map(substitute => this.model.normalizeName(substitute));
    return substitutedNames.includes(name) || substitutedNames.includes(this.model.getClassDisplayName(theClass));
  }

  // The last group of a class on the path of the test, and the interfaces where the path left an implementation; with no group, the path ends only at a substituted exit.
  readThePathAt(integration, group) {
    const seenNames = new Set([this.model.normalizeName(integration.entry)]);
    const namesToVisit = [...seenNames];
    const endInterfaces = new Set();
    while (namesToVisit.length) {
      const name = namesToVisit.pop();
      const method = this.model.findMethod(name);
      const theClass = this.model.findClass(name);
      if (!method || this.isASubstitutedExit(integration, theClass, name)) continue;

      const leftClasses = this.findImplementationsToLeave(theClass, group);
      if (leftClasses.length) endInterfaces.add(theClass);
      for (const reachedName of this.model.listNamesReachedFrom(theClass, method)) {
        if (seenNames.has(reachedName) || leftClasses.includes(this.model.findClass(reachedName))) continue;
        seenNames.add(reachedName);
        namesToVisit.push(reachedName);
      }
    }
    const classes = [...seenNames].map(name => this.model.findClass(name)).filter(Boolean);
    return { lastGroup: Math.max(FIRST_GROUP, ...classes.map(getGroupOfTheClass)), endInterfaces: [...endInterfaces] };
  }

  placeTheTest(integration) {
    const { lastGroup } = this.readThePathAt(integration, null);
    for (let group = FIRST_GROUP; group < lastGroup; group += 1) {
      const path = this.readThePathAt(integration, group);
      if (path.lastGroup <= group) return { group, endInterfaces: path.endInterfaces };
    }
    return { group: lastGroup, endInterfaces: [] };
  }

  getGroupOfTheTest(integration) {
    return this.placeTheTest(integration).group;
  }

  // An implementation of a later group than the test: a created or changed implementation, which the test meets only at the end of that later group.
  listLaterImplementations(endInterface, group) {
    return this.listImplementationsOf(endInterface)
      .filter(implementation => KINDS_THAT_CHANGE_A_CLASS.has(this.model.getKindOfClass(implementation)) && getGroupOfTheClass(implementation) > group);
  }

  describeTheImplementations(endInterfaces, group) {
    const described = endInterfaces
      .filter(endInterface => this.listLaterImplementations(endInterface, group).length)
      .map(endInterface => `${joinNames(this.listImplementationsAtTheEndOf(endInterface, group).map(implementation => this.describeTheImplementationAt(implementation, group)))} as ${this.model.getClassDisplayName(endInterface)}`);
    return described.length ? `; in this group the tests run against ${joinNames(described)}` : "";
  }

  createWriteStep(integration, createStep) {
    const { group, endInterfaces } = this.placeTheTest(integration);
    return createStep(group, `writes the integration tests of ${integration.entry}: ${joinNames(readList(integration.tests))}${this.describeTheImplementations(endInterfaces, group)}`, [integration.file]);
  }

  // The implementation the test ran against is gone at the end of the later group where its file is removed in that group or earlier, or where its code leaves its old file.
  listRemovedImplementations(endInterface, group, laterGroup) {
    return this.listImplementationsAtTheEndOf(endInterface, group)
      .filter(implementation => !this.existsAtTheEndOf(implementation, laterGroup) || (this.isInItsOldFileAtTheEndOf(implementation, group) && !this.isInItsOldFileAtTheEndOf(implementation, laterGroup)));
  }

  // The test file names a removed implementation where the current tree holds the file and the file holds the name the class has in the tree; null where the tree does not tell, because the file is not read or does not exist yet.
  findWhetherTheTestsNameAny(testFile, removedImplementations) {
    if (!this.currentTree || !this.currentTree.holdsTheFile(testFile)) return null;
    return removedImplementations.some(removed => this.currentTree.holdsTheWord(testFile, (removed.oldName || removed.name).split(".").pop()));
  }

  // In each later group that writes an implementation, the tests run again and must pass unchanged; where that group removes the implementation they ran against and the test file names it, the step changes them instead, and where the tree does not tell, the step changes only the lines that name it.
  describeTheLaterStep(integration, group, implementation, removedImplementations) {
    const ranAgainst = `the integration tests of ${integration.entry}, written in group ${group}`;
    const implementationName = this.model.getClassDisplayName(implementation);
    const testNames = joinNames(readList(integration.tests));
    const removedNames = joinNames(removedImplementations.map(removed => this.describeTheImplementationAt(removed, group)));
    const namesARemoved = removedImplementations.length ? this.findWhetherTheTestsNameAny(integration.file, removedImplementations) : false;
    if (namesARemoved === true) return `changes ${ranAgainst}, to run against ${implementationName} in place of ${removedNames}: ${testNames}`;
    if (namesARemoved === null) return `runs again ${ranAgainst}, against ${implementationName} in place of ${removedNames}; change only the lines that name the removed implementation: ${testNames}`;
    return `runs again ${ranAgainst}, against ${implementationName}; they must pass unchanged: ${testNames}`;
  }

  createLaterSteps(integration, createStep) {
    const { group, endInterfaces } = this.placeTheTest(integration);
    return endInterfaces.flatMap(endInterface => this.listLaterImplementations(endInterface, group).map(implementation => {
      const laterGroup = getGroupOfTheClass(implementation);
      const removedImplementations = this.listRemovedImplementations(endInterface, group, laterGroup);
      return createStep(laterGroup, this.describeTheLaterStep(integration, group, implementation, removedImplementations), [integration.file]);
    }));
  }
}
