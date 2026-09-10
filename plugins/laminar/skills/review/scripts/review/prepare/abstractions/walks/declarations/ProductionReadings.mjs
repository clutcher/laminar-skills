import { ASSIGNING_EQUALS_SIGN_PATTERN_SOURCE, compareByPathAndLine, escapeForAPattern, readLanguageFamily, shortenText } from "../../../../../code/index.mjs";
import { countFolderSteps, readFileStem, readFolderPath } from "../../../../../files/paths.mjs";
import { stripTextValuesAndComments, NAMED_KINDS, mapToProductionMirror, namesADeclaredConstant } from "./NamedDeclarationsWalk.mjs";

export const READ_AT_LINES_BELOW = 3;

const IMPORT_OR_PACKAGE_PATTERN = /^\s*(?:package|import|using|require|from\s+\S+\s+import|#include|use)\b/;

const buildInterpretingShapes = name => {
  const word = escapeForAPattern(name);
  const named = `(?:\\.\\s*)?(?:[A-Za-z_$][\\w$]*\\s*(?:\\.|::)\\s*)*${word}(?![\\w$])`;
  const bare = `(?<![\\w$.:])${word}(?![\\w$])`;
  const payload = `(?:\\s*(?:\\([^)]*\\)|\\{[^}]*\\}))?`;
  const armItem = `(?:(?:is|not)\\s+)?[\\w$.:]+${payload}`;
  const armSeparator = `\\s*(?:,|\\||\\bor\\b)\\s*`;
  return [
    new RegExp(`(?:==|!=|<>)=?\\s*${named}`),
    new RegExp(`(?<![\\w$])${named}\\s*(?:==|!=|<>)`),
    new RegExp(`\\bequals\\w*\\s*\\([^)]*(?<![\\w$])${word}(?![\\w$])`),
    new RegExp(`(?<![\\w$])${word}\\s*\\)?\\s*\\.\\s*equals\\w*\\s*\\(`),
    new RegExp(`\\bcase\\b[^:]*?(?<![\\w$])${word}(?![\\w$])`),
    new RegExp(`^\\s*(?:\\|\\s*)?(?:${armItem}${armSeparator})*(?:(?:is|not)\\s+)?${named}${payload}(?:${armSeparator}${armItem})*\\s*(?:\\bif\\b[^;]*?)?(?:->|=>)`),
    new RegExp(`\\bis\\s+(?:not\\s+)?${named}`),
    new RegExp(`\\b(?:if|elif|elsif|unless|while|when|match|switch|guard)\\b.*(?<![\\w$])${word}(?![\\w$])`),
    new RegExp(`\\bmatches!\\s*\\(.*(?<![\\w$])${word}(?![\\w$])`),
    new RegExp(`\\berrors\\s*\\.\\s*(?:Is|As)\\s*\\([^,]*,\\s*${named}`),
    new RegExp(`\\b(?:put\\w*|entry|get|getOrDefault|contains\\w*|has|includes|indexOf|remove)\\s*\\(\\s*${named}\\s*[,)]`),
    new RegExp(`\\[\\s*${named}\\s*\\]\\s*:`),
    new RegExp(`${named}\\s+to\\s`),
    new RegExp(`(?:^|[{,])\\s*[A-Za-z_$][\\w$]*\\s*\\.\\s*${word}\\s*:(?!:)`),
    new RegExp(`(?:\\b(?:Map|Set|EnumSet|ImmutableMap|ImmutableSet)\\s*\\.\\s*of\\w*|\\b(?:mapOf|setOf|hashMapOf|mutableMapOf)|\\bdict)\\s*\\(.*${bare}`),
  ];
};

const assignsTheValue = (code, name) => new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}\\s*(?::[^=]*)?${ASSIGNING_EQUALS_SIGN_PATTERN_SOURCE}`).test(code);

const interpretsTheValue = (text, name, shapes) => {
  const code = stripTextValuesAndComments(text);
  return !IMPORT_OR_PACKAGE_PATTERN.test(code) && !assignsTheValue(code, name) && shapes.some(shape => shape.test(code));
};

const buildQualifiedUsePattern = name => new RegExp(`([A-Za-z_$][\\w$]*)(?:\\.|::)\\s*${escapeForAPattern(name)}(?![\\w$])`, "g");

export class ProductionReadings {
  constructor(repositoryText, testCode, references, declarationEnclosingTypes, moduleRootOf = () => "") {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.references = references;
    this.declarationEnclosingTypes = declarationEnclosingTypes;
    this.findModuleRoot = moduleRootOf;
  }

  readTheLinesThatReadThem(found, testPath) {
    const { listed, homeRoot, stopped } = found;
    return { declarations: listed.map(({ declaration }) => this.addTheReadPlaces(declaration, testPath, homeRoot)), homeRoot, stopped };
  }

  addTheReadPlaces(declaration, testPath, homeRoot) {
    if (declaration.kind !== NAMED_KINDS.VALUE || this.testCode.isTestPlace(declaration)) return declaration;
    const places = this.findReadingPlaces(declaration);
    const shapes = buildInterpretingShapes(declaration.name);
    const reading = places
      .filter(place => !this.testCode.isTestPlace(place) && !(place.path === declaration.path && place.line === declaration.line))
      .filter(place => this.readsTheDeclaration(place, declaration))
      .filter(place => interpretsTheValue(this.readFullText(place), declaration.name, shapes));
    const readAt = this.sortByNearnessToTheTest(reading, testPath, homeRoot).map(place => ({ ...place, below: this.readTheLinesBelowThePlace(place) }));
    return { ...declaration, readAt };
  }

  sortByNearnessToTheTest(places, testPath, homeRoot) {
    return places
      .map(place => ({ ...place, moduleRoot: this.findModuleRoot(place.path) }))
      .map(place => ({ place, sameModule: Boolean(homeRoot) && place.moduleRoot === homeRoot, steps: countFolderSteps(place.path, mapToProductionMirror(testPath)) }))
      .sort((left, right) => Number(right.sameModule) - Number(left.sameModule) || left.steps - right.steps || compareByPathAndLine(left.place, right.place))
      .map(({ place }) => place);
  }

  readFullText(place) {
    const lines = this.repositoryText.readFileLines(place.path) || [];
    return lines[place.line - 1] === undefined ? place.text : lines[place.line - 1];
  }

  readTheLinesBelowThePlace(place) {
    const lines = this.repositoryText.readFileLines(place.path) || [];
    const below = [];
    for (let line = place.line + 1; line <= place.line + READ_AT_LINES_BELOW && line <= lines.length; line++) {
      const text = String(lines[line - 1] || "").trim();
      if (text) below.push({ line, text: shortenText(text) });
    }
    return below;
  }

  readsTheDeclaration(place, declaration) {
    if (place.path === declaration.path) return true;
    const declaredEnclosingType = this.declarationEnclosingTypes.readRememberedEnclosingType(declaration);
    const qualifiers = [...stripTextValuesAndComments(this.readFullText(place)).matchAll(buildQualifiedUsePattern(declaration.name))].map(match => match[1]);
    if (qualifiers.length) return qualifiers.some(qualifier => this.declarationEnclosingTypes.namesTheEnclosingType(qualifier, declaredEnclosingType, declaration.path));
    if (readFolderPath(place.path) === readFolderPath(declaration.path)) return true;
    const named = this.references.lines.collectNamesInFile(place.path);
    return [readFileStem(declaration.path), declaredEnclosingType].filter(Boolean).some(enclosingTypeName => named.has(enclosingTypeName));
  }

  findReadingPlaces(declaration) {
    if (!namesADeclaredConstant(this.references, declaration.name, declaration.path)) return this.references.findNamingPlaces(declaration.name, readLanguageFamily(declaration.path));
    const abstraction = this.references.abstractionLookup.findAbstractionAt(declaration.path, declaration.line, declaration.name);
    return abstraction ? this.references.findPlacesThatMayReach(abstraction) : [];
  }
}
