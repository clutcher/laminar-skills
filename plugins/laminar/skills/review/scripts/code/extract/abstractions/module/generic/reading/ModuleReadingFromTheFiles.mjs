import { isOfTheFamilyOf } from "../../../../../inputs/source/drivers/LanguageRegistry.mjs";
import { findMarkedCodeLines } from "../../../../../inputs/source/declarations/MarkedDeclarations.mjs";
import { CLASS_FINDER_REGISTRY } from "../../../class/index.mjs";
import { MODULE_FINDER_REGISTRY } from "../../index.mjs";
import { ApplicationFrameworks } from "../../../application/generic/frameworks/ApplicationFrameworks.mjs";
import { findDeployableFolder } from "../../../application/generic/ApplicationFolders.mjs";
import { isADependencyFile } from "../../../application/generic/dependencies/DependencyFiles.mjs";
import { ModuleShapes } from "../shapes/ModuleShapes.mjs";
import { ModuleReading } from "./ModuleReading.mjs";

const listApplicationMarks = () => CLASS_FINDER_REGISTRY.listEveryStrategy().map(strategy => strategy.applicationMark).filter(Boolean);

const carriesAnApplicationMark = (lines, applicationMarks) => applicationMarks.some(mark => findMarkedCodeLines(lines, mark).length > 0);

// The module reading of a tree with no code graph, such as the tree after a shape: the frameworks come from the dependency files, the application starts from the files that carry an application mark, and the shapes from the paths alone.
export function createModuleReadingFromTheFiles({ repository, roots, paths, readFileLines }) {
  const dependencyFiles = paths.filter(isADependencyFile).map(filePath => ({ path: filePath, lines: readFileLines(filePath) }));
  const applications = new ApplicationFrameworks(roots, dependencyFiles);
  const applicationMarks = listApplicationMarks();
  const applicationStartsByLanguageMap = new Map();
  const findApplicationStarts = language => {
    if (!applicationStartsByLanguageMap.has(language)) applicationStartsByLanguageMap.set(language, paths.filter(filePath => isOfTheFamilyOf(filePath, language) && carriesAnApplicationMark(readFileLines(filePath), applicationMarks)));
    return applicationStartsByLanguageMap.get(language);
  };
  const findFrameworksAt = folder => applications.findFrameworksOfApplication(findDeployableFolder(folder, roots) ?? "");
  const shapes = ModuleShapes.findShapes(MODULE_FINDER_REGISTRY.shapeFinders, paths);
  return new ModuleReading(repository, { findApplicationStarts, findFrameworksAt }, shapes);
}
