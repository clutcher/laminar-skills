import { MIN_VALUE_NAME_LENGTH } from "../../../../inputs/source/drivers/LanguageDriver.mjs";
import { findValueQualifierBefore } from "../../../../inputs/source/text/QualifierText.mjs";
import { RelationFinder } from "../../../finders/RelationFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { isUpperSnakeName, namesAType } from "../../../../inputs/source/names/NamingConventions.mjs";
import { isACallAfter } from "../../method/generic/references/NameReferences.mjs";
import { endsInAReceiverSeparator } from "../../method/generic/calls/CallScanner.mjs";

const IDENTIFIER_PATTERN = /(?<![\w$])[A-Za-z_$][\w$]*/g;
const LEADING_DOT_PATTERN = /\.\s*$/;
const VALUE_BEFORE_A_DOT_PATTERN = /[\w$)\]}"'?!.]$/;
const TYPE_USE_AFTER_PATTERN = /^\s*(?:\(|\.|::|<)/;
const CONSTRUCTOR_BEFORE_PATTERN = /\bnew\s+$/;

function readsAsAValue(readsImplicitMembers, name, before, after, qualifier, methodRelationFinder) {
  if (qualifier) return endsInAReceiverSeparator(before, methodRelationFinder) && (namesAType(name) || !isACallAfter(after));
  if (LEADING_DOT_PATTERN.test(before)) return readsImplicitMembers && !VALUE_BEFORE_A_DOT_PATTERN.test(before.replace(LEADING_DOT_PATTERN, ""));
  if (endsInAReceiverSeparator(before, methodRelationFinder)) return false;
  return namesAType(name) && !TYPE_USE_AFTER_PATTERN.test(after) && !CONSTRUCTOR_BEFORE_PATTERN.test(before);
}

export class GenericVariableRelationFinder extends RelationFinder {
  constructor() {
    super(Scale.VARIABLE);
    this.readsImplicitMembers = false;
  }

  findValueReferences(code, methodRelationFinder) {
    const text = String(code);
    const found = [];
    for (const match of text.matchAll(IDENTIFIER_PATTERN)) {
      const name = match[0];
      if (name.length < MIN_VALUE_NAME_LENGTH) continue;
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + name.length);
      const qualifier = findValueQualifierBefore(text, match.index);
      const bare = !qualifier && !LEADING_DOT_PATTERN.test(before);
      if (isUpperSnakeName(name) || readsAsAValue(this.readsImplicitMembers, name, before, after, qualifier, methodRelationFinder)) found.push({ at: match.index, name, qualifier, bare });
    }
    return found;
  }
}
