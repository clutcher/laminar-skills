import { LanguageDriver, NO_DECLARATION } from "../../drivers/LanguageDriver.mjs";
import { GraphQLLanguage } from "./GraphQLLanguage.mjs";
import { TYPE_HEAD_PATTERN, readCodeOfAHead, findMemberEnds, collectSchemaHeads } from "./GraphQLSourceText.mjs";
import { CLASS_FINDER_REGISTRY } from "../../../../extract/abstractions/class/index.mjs";
import { METHOD_FINDER_REGISTRY } from "../../../../extract/abstractions/method/index.mjs";
import { VARIABLE_FINDER_REGISTRY } from "../../../../extract/abstractions/variable/index.mjs";
import { FinderContext } from "../../../../extract/finders/FinderContext.mjs";

const GRAPHQL = "graphql";

const listFindersOfTheSchema = () => [CLASS_FINDER_REGISTRY, METHOD_FINDER_REGISTRY, VARIABLE_FINDER_REGISTRY].map(registry => registry.findFinder(FinderContext.createForLanguage(GRAPHQL)));

export class GraphQLDriver extends LanguageDriver {
  get customFunctionNamePattern() {
    return GraphQLLanguage.functionNamePattern;
  }

  get commentForms() {
    return GraphQLLanguage.commentForms;
  }

  get fileHoldsTypesOnly() {
    return true;
  }

  findDeclarationHeads(lines) {
    return collectSchemaHeads(lines);
  }

  findMemberEnds(lines) {
    return findMemberEnds(lines);
  }

  findValueEnds(lines) {
    return this.findMemberEnds(lines);
  }

  findBlockEnds(lines) {
    return this.findMemberEnds(lines);
  }

  readDeclaration(headLine) {
    const code = readCodeOfAHead(headLine);
    for (const finder of listFindersOfTheSchema()) {
      const declaration = finder.findDeclaration(code);
      if (declaration) return declaration;
    }
    return NO_DECLARATION;
  }

  looksLikeDeclaration(line) {
    return TYPE_HEAD_PATTERN.test(String(line));
  }

  findTypeDisplayName(headText, name, application) {
    return this.readClassFinder().findTypeDisplayName(headText, name, application);
  }

  findSchemaType(headText, name, application) {
    return this.readClassFinder().findSchemaType(headText, name, application);
  }

  readClassFinder() {
    return CLASS_FINDER_REGISTRY.findFinder(FinderContext.createForLanguage(GRAPHQL));
  }
}
