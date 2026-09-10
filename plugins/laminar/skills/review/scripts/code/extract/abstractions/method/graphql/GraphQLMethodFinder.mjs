import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { findMemberName } from "../../../../inputs/source/languages/graphql/GraphQLSourceText.mjs";
import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

const FIELD_WITH_ARGUMENTS_PATTERN = /^\s*[A-Za-z_]\w*\s*\(/;

export class GraphQLMethodFinder extends GenericMethodFinder {
  language = "graphql";

  findDeclaration(code) {
    const member = findMemberName(code);
    return member && FIELD_WITH_ARGUMENTS_PATTERN.test(code) ? { scale: Scale.METHOD.name, name: member, scope: null } : null;
  }
}
