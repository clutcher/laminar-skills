import { findDeclarationInLine } from "../types/DeclaredTypes.mjs";
import { findElementType, parseType, parseTypeArguments } from "../../../../../inputs/source/text/TypeText.mjs";
import { namesALiteral } from "../values/DeclaredValues.mjs";
import { Scale } from "../../../../../graph/abstractions/Scale.mjs";

const KEYED_COLLECTION_WORD_PATTERN = /map|dict|mapping/i;
const GO_MAP_PATTERN = /^map\[/;
const INTERFACE_PREFIX_PATTERN = /^I(?=[A-Z])/;
const CONSONANT_THEN_Y_PATTERN = /[^aeiou]y$/;

const readWords = text => String(text || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();

const buildPlurals = word => [`${word}s`, `${word}es`, ...(CONSONANT_THEN_Y_PATTERN.test(word) ? [`${word.slice(0, -1)}ies`] : [])];

const isKeyed = type => GO_MAP_PATTERN.test(type.text)
  || KEYED_COLLECTION_WORD_PATTERN.test(type.simple)
  || parseTypeArguments(type.text).length > 1;

const listNamesOfTheType = type => [type.simple, ...(INTERFACE_PREFIX_PATTERN.test(type.simple) ? [type.simple.replace(INTERFACE_PREFIX_PATTERN, "")] : [])].map(readWords);

const listNamesOfItsElements = typeText => {
  const element = parseType(findElementType(typeText));
  return element ? listNamesOfTheType(element).flatMap(buildPlurals) : [];
};

const findDeclaredType = (tag, diffDriver) => {
  const declared = findDeclarationInLine(String(tag.text || ""), tag.name, diffDriver, false);
  const keepsAParameterAsItIs = Boolean(declared && declared.alias && tag.constructorHead);
  return keepsAParameterAsItIs ? findDeclarationInLine(tag.constructorHead, declared.alias, diffDriver, false) : declared;
};

export function restatesItsType(tag, diffDriver) {
  const declared = findDeclaredType(tag, diffDriver);
  const type = declared && declared.type ? parseType(declared.type) : null;
  if (!type || isKeyed(type)) return false;
  const nameWords = readWords(tag.name);
  return listNamesOfTheType(type).includes(nameWords) || listNamesOfItsElements(type.text).includes(nameWords);
}

const isAMethod = member => member.tag.scale === Scale.METHOD.name;

export const isAnItem = (member, diffDriver) => isAMethod(member)
  || namesALiteral(member.tag.text)
  || !restatesItsType(member.tag, diffDriver);

export function groupMemberItems(givenMembers, { readMember: memberOf = givenMember => givenMember, findEnclosingType: enclosingTypeOf, diffDriver }) {
  const items = [];
  const fieldItemByEnclosingTypeMap = new Map();
  for (const givenMember of givenMembers) {
    const member = memberOf(givenMember);
    if (!isAnItem(member, diffDriver)) continue;
    if (isAMethod(member)) { items.push([givenMember]); continue; }
    const enclosingType = enclosingTypeOf(givenMember);
    if (!fieldItemByEnclosingTypeMap.has(enclosingType)) {
      fieldItemByEnclosingTypeMap.set(enclosingType, []);
      items.push(fieldItemByEnclosingTypeMap.get(enclosingType));
    }
    fieldItemByEnclosingTypeMap.get(enclosingType).push(givenMember);
  }
  return items;
}
