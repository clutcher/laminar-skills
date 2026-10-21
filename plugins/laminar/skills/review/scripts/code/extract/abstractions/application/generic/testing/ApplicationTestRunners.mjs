import { readFolderPath } from "../../../../../../files/paths.mjs";
import { isTestPath } from "../../../../../inputs/source/TestCode.mjs";
import { findDeployableFolder } from "../ApplicationFolders.mjs";
import { isATestRunner } from "../frameworks/ApplicationFrameworks.mjs";
import { findFinderDeclaringTheApplication, findFinderOfASharedBuildScript } from "../../index.mjs";

const NO_TEST_RUNNER_FACTS = Object.freeze({});

const THE_APPLICATION_WITH_NO_TEST_RUNNER_FACTS = Object.freeze({ hasNoTestRunner: true });

const NO_LINES = Object.freeze([]);

const isTheFolderOrAFolderAbove = (folder, applicationFolder) => folder === "" || folder === applicationFolder || applicationFolder.startsWith(`${folder}/`);

const declaresTheTestRunnerOfItsBuildTool = rootPath => Boolean((findFinderDeclaringTheApplication(rootPath) || {}).declaresTheTestRunner);

export class ApplicationTestRunners {
  constructor({ roots, applications, repositoryPaths, readFileLines }) {
    this.roots = roots;
    this.applications = applications;
    this.repositoryPaths = repositoryPaths;
    this.readFileLines = filePath => readFileLines(filePath) || NO_LINES;
  }

  readTheFacts(applicationFolder) {
    return this.hasNoTestRunner(applicationFolder) ? THE_APPLICATION_WITH_NO_TEST_RUNNER_FACTS : NO_TEST_RUNNER_FACTS;
  }

  hasNoTestRunner(applicationFolder) {
    return this.listRootsIn(applicationFolder).every(declaresTheTestRunnerOfItsBuildTool)
      && !this.declaresATestRunnerFor(applicationFolder)
      && !this.holdsATestFile(applicationFolder);
  }

  listRootsIn(applicationFolder) {
    return this.roots.filter(rootPath => readFolderPath(rootPath) === applicationFolder);
  }

  listRootsInOrAbove(applicationFolder) {
    return this.roots.filter(rootPath => isTheFolderOrAFolderAbove(readFolderPath(rootPath), applicationFolder));
  }

  declaresATestRunnerFor(applicationFolder) {
    const rootsInOrAbove = this.listRootsInOrAbove(applicationFolder);
    return rootsInOrAbove.some(rootPath => this.applications.listDeclaredIn(readFolderPath(rootPath)).some(isATestRunner))
      || rootsInOrAbove.some(rootPath => this.declaresATestSetupIn(rootPath, findFinderDeclaringTheApplication(rootPath)))
      || this.repositoryPaths.some(filePath => this.declaresATestSetupInASharedBuildScript(filePath));
  }

  declaresATestSetupInASharedBuildScript(filePath) {
    const finder = findFinderOfASharedBuildScript(filePath);
    return Boolean(finder) && finder.declaresTheTestRunner && this.declaresATestSetupIn(filePath, finder);
  }

  declaresATestSetupIn(filePath, finder) {
    return Boolean(finder) && finder.declaresATestSetup(this.readFileLines(filePath));
  }

  holdsATestFile(applicationFolder) {
    return this.repositoryPaths.some(filePath => isTestPath(filePath) && findDeployableFolder(filePath, this.roots) === applicationFolder);
  }
}
