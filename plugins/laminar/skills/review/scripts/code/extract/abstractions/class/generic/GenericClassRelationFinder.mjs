
import { readDeclaration } from "../../../../inputs/source/declarations/DeclarationHeadReading.mjs";
import { stripTypeArguments } from "../../../../inputs/source/SourceText.mjs";
import { RelationFinder } from "../../../finders/RelationFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

const SUPERTYPE_OPENING_PATTERN = /\b(?:extends|implements|with)\b|:/;
const SUPERTYPE_SEPARATOR_PATTERN = /,|\b(?:extends|implements|with)\b/;
const SUPERTYPE_LIST_END_PATTERN = /\bwhere\b|[{=]/;
const SUPERTYPE_NAME_PATTERN = /^(?:[A-Za-z_$][\w$]*\.)*([A-Za-z_$][\w$]*)/;
const WORDS_NEVER_A_SUPERTYPE = new Set(["public", "private", "protected", "internal", "open", "abstract", "sealed", "final", "virtual", "object", "metaclass"]);

function stripBracketedGroups(text) {
  let out = text;
  for (let previous = null; previous !== out;) {
    previous = out;
    out = out.replace(/\([^()]*\)/g, "");
  }
  return out;
}

const readFirstBracketedGroup = text => (/^\s*\(([^()]*)\)/.exec(text) || [])[1] || "";

function findSupertypeNamesIn(listText) {
  return listText.split(SUPERTYPE_SEPARATOR_PATTERN)
    .map(piece => (SUPERTYPE_NAME_PATTERN.exec(piece.trim()) || [])[1])
    .filter(name => name && !WORDS_NEVER_A_SUPERTYPE.has(name));
}

const NOT_A_NAMED_CLASS = null;

const flattenHead = headText => stripTypeArguments(String(headText || "").replace(/\s+/g, " ")).split("{")[0];

const isANamedClass = read => read.scale === Scale.CLASS.name && Boolean(read.name);

const findTextAfterTheClassNameIn = (headText, language) => {
  const flat = flattenHead(headText);
  const read = readDeclaration(language, flat);
  if (!isANamedClass(read)) return NOT_A_NAMED_CLASS;
  return flat.slice(flat.indexOf(read.name) + read.name.length);
};

export class GenericClassRelationFinder extends RelationFinder {
  constructor() {
    super(Scale.CLASS);
    this.supertypesInBrackets = false;
  }

  listSupertypes(headText, language) {
    const afterName = findTextAfterTheClassNameIn(headText, language);
    if (afterName === NOT_A_NAMED_CLASS) return [];
    if (this.supertypesInBrackets) return findSupertypeNamesIn(readFirstBracketedGroup(afterName));
    const rest = stripBracketedGroups(afterName).split(SUPERTYPE_LIST_END_PATTERN)[0];
    const opening = SUPERTYPE_OPENING_PATTERN.exec(rest);
    return opening ? [...new Set(findSupertypeNamesIn(rest.slice(opening.index + opening[0].length)))] : [];
  }

  isAStructuralInterface() {
    return false;
  }

  findInterfaceMethods() {
    return [];
  }

  findInterfaceResults() {
    return null;
  }

  findUnderlyingType() {
    return "";
  }
}
