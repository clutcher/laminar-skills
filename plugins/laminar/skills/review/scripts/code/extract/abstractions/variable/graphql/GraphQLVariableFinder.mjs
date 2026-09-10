import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { findMemberName } from "../../../../inputs/source/languages/graphql/GraphQLSourceText.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class GraphQLVariableFinder extends GenericVariableFinder {
  language = "graphql";

  findDeclaration(code) {
    const member = findMemberName(code);
    return member ? { scale: Scale.VARIABLE.name, name: member, scope: null } : null;
  }
}
