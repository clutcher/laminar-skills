import { GenericModuleRelationFinder } from "../../generic/GenericModuleRelationFinder.mjs";

export class JvmSpringModuleRelationFinder extends GenericModuleRelationFinder {
  family = "jvm";
  framework = "spring";

  findCrossModuleImports(numberedLines, importLine, packages) {
    if (!importLine || !packages.applicationPackage || !packages.modulePackage) return [];
    const found = [];
    for (const { line, text } of numberedLines) {
      const read = importLine.exec(text);
      if (!read) continue;
      const imported = read[1];
      if (!imported.startsWith(`${packages.applicationPackage}.`)) continue;
      if (imported.startsWith(`${packages.modulePackage}.`)) continue;
      found.push({ line, text: text.trim() });
    }
    return found;
  }
}
