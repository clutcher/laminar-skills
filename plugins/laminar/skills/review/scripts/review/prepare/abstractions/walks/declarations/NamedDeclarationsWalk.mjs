import { CONTROL_WORD_PATTERN_SOURCE, declaresAnUpperSnakeValueIn, findDriver, escapeForAPattern, isOwnCodeAt, isUpperSnakeName, LanguageDriver, readLanguageFamily, Scale } from "../../../../../code/index.mjs";
import { measureSharedFolderDepth, readFolderPath } from "../../../../../files/paths.mjs";

export const MAX_NAMED_DECLARATIONS = 30;
const MAX_DECLARATIONS_PER_NAME = 3;

const TEXT_VALUE_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
const LINE_COMMENT_PATTERN = /\/\/.*$|(?:^|\s)#\s.*$/;
const HELPER_CALL_PATTERN = /(?<![\w$.:])([a-z_$][\w$]*)\s*\(/g;
const WORDS_NEVER_A_HELPER = new Set([...CONTROL_WORD_PATTERN_SOURCE.split("|"), "super", "this", "synchronized", "assert", "typeof", "sizeof", "elif", "match", "when", "fn", "function", "def"]);
const WORDS_BEFORE_A_CALL = new Set(["return", "new", "throw", "await", "yield", "else", "case", "not", "and", "or", "in", "is"]);

export const NAMED_KINDS = Object.freeze({ VALUE: "VALUE", HELPER: "HELPER" });

export const stripTextValuesAndComments = text => String(text).replace(TEXT_VALUE_PATTERN, "\"\"").replace(LINE_COMMENT_PATTERN, "");

const ANY_LANGUAGE = new LanguageDriver(null);

export function collectNamesInBody(bodyLines, ownName, driver = ANY_LANGUAGE) {
  const namedByNameMap = new Map();
  const add = (name, kind, qualifier, bare) => {
    if (name === ownName || namedByNameMap.has(name)) return;
    namedByNameMap.set(name, { name, kind, qualifier, bare });
  };
  for (const line of bodyLines) {
    const code = stripTextValuesAndComments(line);
    const found = [
      ...driver.findValueReferences(code).map(valueReference => ({ ...valueReference, kind: NAMED_KINDS.VALUE })),
      ...[...code.matchAll(HELPER_CALL_PATTERN)].filter(match => !WORDS_NEVER_A_HELPER.has(match[1]))
        .map(match => ({ at: match.index, name: match[1], kind: NAMED_KINDS.HELPER })),
    ].sort((left, right) => left.at - right.at);
    for (const { name, kind, qualifier, bare } of found) add(name, kind, qualifier || "", Boolean(bare));
  }
  return [...namedByNameMap.values()];
}

const SIGNATURE_BEFORE_PATTERN = /^(?:[\w$[\].?@]+\s+)+$/;
const TYPE_ARGUMENT_PATTERN = /<[^<>]*>/g;
const HEAD_THAT_OPENS_A_BODY_PATTERN = /[{:]\s*$/;

const stripTypeArguments = text => {
  let out = text;
  for (let previous = null; previous !== out;) { previous = out; out = out.replace(TYPE_ARGUMENT_PATTERN, ""); }
  return out;
};

const doesTheDriverReadTheMethod = (driver, text, name) => {
  if (!driver || !HEAD_THAT_OPENS_A_BODY_PATTERN.test(text) || !driver.looksLikeDeclaration(text)) return false;
  const read = driver.readDeclaration(text);
  return read.scale === Scale.METHOD.name && read.name === name;
};

const isASignatureBeforeTheName = before => {
  const firstWord = (before.match(/^[\w$]+/) || [""])[0];
  return SIGNATURE_BEFORE_PATTERN.test(before) && !WORDS_BEFORE_A_CALL.has(firstWord);
};

const opensAParameterListAfterASignature = (text, name) => {
  const code = stripTypeArguments(stripTextValuesAndComments(text).trim());
  const at = new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}\\s*\\(`).exec(code);
  if (!at) return false;
  return isASignatureBeforeTheName(code.slice(0, at.index));
};

const declaresAHelper = (driver, text, name) => doesTheDriverReadTheMethod(driver, text, name) || opensAParameterListAfterASignature(text, name);

const IMPORTED_MEMBER_PATTERN = /([A-Za-z_$][\w$]*)(?:\.|::)([A-Za-z_$][\w$]*)\s*;?\s*$/;
const FROM_IMPORT_PATTERN = /^\s*from\s+([\w.]+)\s+import\s+(.+)$/;

const collectImportedEnclosingTypes = (driver, lines) => {
  const enclosingTypeByNameMap = new Map();
  for (const line of lines || []) {
    if (!driver || !driver.isImportLine(line)) continue;
    const fromImport = FROM_IMPORT_PATTERN.exec(line);
    if (fromImport) {
      const enclosingTypeName = fromImport[1].split(".").pop();
      for (const name of fromImport[2].split(",").map(segment => segment.trim().split(/\s+/)[0])) if (name) enclosingTypeByNameMap.set(name, enclosingTypeName);
      continue;
    }
    const member = IMPORTED_MEMBER_PATTERN.exec(line);
    if (member) enclosingTypeByNameMap.set(member[2], member[1]);
  }
  return enclosingTypeByNameMap;
};

const selectNearest = (places, ownPath) => {
  const deepest = Math.max(...places.map(place => measureSharedFolderDepth(place.path, ownPath)));
  return places.filter(place => measureSharedFolderDepth(place.path, ownPath) === deepest);
};

const TEST_FOLDER_NAMES = new Set(["test", "tests"]);
const PRODUCTION_FOLDER_NAME = "main";

export const mapToProductionMirror = given => given.split("/")
  .map((segment, index, segments) => (index < segments.length - 1 && TEST_FOLDER_NAMES.has(segment) ? PRODUCTION_FOLDER_NAME : segment)).join("/");

const isNearTheTest = (declarationPath, testPath) => [readFolderPath(testPath), readFolderPath(mapToProductionMirror(testPath))].includes(readFolderPath(declarationPath));

export const namesADeclaredConstant = (references, name, filePath) => isUpperSnakeName(name) && references.abstractionLookup.declaresAValueNamed(name, readLanguageFamily(filePath));

export class NamedDeclarationsWalk {
  constructor(repositoryText, references, declarationEnclosingTypes, moduleRootOf = () => "") {
    this.repositoryText = repositoryText;
    this.references = references;
    this.declarationEnclosingTypes = declarationEnclosingTypes;
    this.findModuleRoot = moduleRootOf;
  }

  findNamedDeclarations(abstraction, numberedBodyLines) {
    const ownLines = abstraction.lines ? [[abstraction.lines.from, abstraction.lines.to]] : [];
    const testDriver = findDriver(abstraction.path);
    const importedEnclosingTypes = collectImportedEnclosingTypes(testDriver, this.repositoryText.readFileLines(abstraction.path));
    const listed = [];
    for (const named of collectNamesInBody(numberedBodyLines.map(numberedBodyLine => numberedBodyLine.text), abstraction.name, testDriver || ANY_LANGUAGE)) {
      const places = this.findDeclaringPlaces(named, abstraction, numberedBodyLines).filter(place => !isOwnCodeAt(place, abstraction.path, ownLines));
      const enclosingTypeName = named.qualifier || importedEnclosingTypes.get(named.name) || "";
      const reachable = enclosingTypeName || !this.needsANearbyDeclaration(named) ? places : places.filter(place => isNearTheTest(place.path, abstraction.path));
      for (const place of this.choosePlaces(reachable, abstraction.path, enclosingTypeName)) {
        if (listed.length === MAX_NAMED_DECLARATIONS) return { listed, stopped: true };
        listed.push({ declaration: { name: named.name, kind: named.kind, path: place.path, line: place.line, text: place.text }, enclosingTypeName: place.enclosingTypeName });
      }
    }
    return { listed, stopped: false };
  }

  findTheHomeRootOf(abstraction) {
    return this.findModuleRoot(mapToProductionMirror(abstraction.path)) || this.findModuleRoot(abstraction.path);
  }

  needsANearbyDeclaration(named) {
    return named.kind === NAMED_KINDS.VALUE && named.bare && !isUpperSnakeName(named.name);
  }

  findDeclaringPlaces(named, abstraction, numberedBodyLines) {
    if (named.kind !== NAMED_KINDS.VALUE) {
      return this.references.findNamingPlaces(named.name, readLanguageFamily(abstraction.path)).filter(place => declaresAHelper(findDriver(place.path), place.text, named.name));
    }
    const places = namesADeclaredConstant(this.references, named.name, abstraction.path)
      ? this.references.findDeclarationPlacesReadAtLines(abstraction.path, numberedBodyLines.map(numberedBodyLine => numberedBodyLine.line), named.name)
      : this.references.findNamingPlaces(named.name, readLanguageFamily(abstraction.path));
    return places.map(place => this.findTheValueDeclaredAt(place, named.name)).filter(Boolean);
  }

  findTheValueDeclaredAt(place, name) {
    const driver = findDriver(place.path);
    const declared = driver ? driver.findValueDeclaredAt(this.repositoryText.readFileLines(place.path) || [], place.line, name) : null;
    if (declared) return { ...place, enclosingTypeName: declared.enclosingTypeName };
    return isUpperSnakeName(name) && declaresAnUpperSnakeValueIn(stripTextValuesAndComments(place.text), name) ? place : null;
  }

  choosePlaces(places, ownPath, enclosingTypeName) {
    const inTheOwnFile = places.filter(place => place.path === ownPath);
    if (inTheOwnFile.length) return inTheOwnFile.slice(0, MAX_DECLARATIONS_PER_NAME);
    const matchingPlaces = enclosingTypeName ? places.filter(place => this.declarationEnclosingTypes.namesTheEnclosingType(enclosingTypeName, place.enclosingTypeName, place.path)) : places;
    return matchingPlaces.length ? selectNearest(matchingPlaces, ownPath).slice(0, MAX_DECLARATIONS_PER_NAME) : [];
  }
}
