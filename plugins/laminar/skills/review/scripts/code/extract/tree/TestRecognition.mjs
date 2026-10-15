import { TestCode } from "../../inputs/source/TestCode.mjs";
import { findDriver } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { FinderContext } from "../finders/FinderContext.mjs";
import { ROLE_KINDS } from "../../graph/abstractions/Role.mjs";
import { TEST_KINDS, readTestKindAtTheHead } from "../abstractions/method/generic/testing/TestKinds.mjs";

export class TestRecognition {
  constructor({ change, walk, applications }) {
    const linesByPathMap = new Map(change.files.map(file => [file.path, file.lines]));
    this.testCode = new TestCode(filePath => linesByPathMap.get(filePath) || null);
    this.walk = walk;
    this.applications = applications;
  }

  isTestCode(filePath, lines) {
    return this.testCode.isTestCode(filePath, lines);
  }

  readTestKind(abstraction, headLine) {
    if (headLine === null) return this.readTestKindWithoutAHead(abstraction);
    return this.findInlineTestKindAt(abstraction.path, headLine) || readTestKindAtTheHead(this.walk.readTestFacts(abstraction.path), headLine);
  }

  readTestKindWithoutAHead(abstraction) {
    if (this.isATestCallbackIn(abstraction.path, abstraction.name)) return TEST_KINDS.HOOK;
    return this.walk.readTestFacts(abstraction.path).everyMethodIsATest ? TEST_KINDS.TEST : TEST_KINDS.HELPER;
  }

  findInlineTestKindAt(filePath, headLine) {
    const testRole = this.walk.findRolesAt(filePath, headLine).find(role => role.kind === ROLE_KINDS.TEST);
    return testRole && testRole.facts ? testRole.facts.testKind || null : null;
  }

  isATestCallbackIn(filePath, name) {
    const driver = findDriver(filePath);
    const context = FinderContext.createForAWalkedFile(filePath, this.walk.findFrameworksMarkedInTheWalkedFile(filePath), this.applications);
    return Boolean(driver && driver.isTestCallback && driver.isTestCallback(name, context));
  }
}
