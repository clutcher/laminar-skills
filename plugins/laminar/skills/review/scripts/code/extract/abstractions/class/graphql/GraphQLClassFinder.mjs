import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { TYPE_HEAD_PATTERN } from "../../../../inputs/source/languages/graphql/GraphQLSourceText.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

const TYPE_EXTENSION_PATTERN = /^\s*extend\s/;
const TYPE_WITH_FIELDS_PATTERN = /^\s*(?:extend\s+)?(?:type|input|interface)\s/;
const INPUT_TYPE_PATTERN = /^\s*(?:extend\s+)?input\s/;

const APPLICATION_MARK = ":";
const EXTENSION_MARK = " (extended)";

export class GraphQLClassFinder extends GenericClassFinder {
  language = "graphql";

  findDeclaration(code) {
    const type = TYPE_HEAD_PATTERN.exec(code);
    return type ? { scale: Scale.CLASS.name, name: type[1], scope: null } : null;
  }

  findTypeDisplayName(headText, name, application) {
    const typeName = TYPE_EXTENSION_PATTERN.test(String(headText)) ? `${name}${EXTENSION_MARK}` : name;
    return application ? `${application}${APPLICATION_MARK}${typeName}` : typeName;
  }

  findSchemaType(head, name, application) {
    return {
      displayName: this.findTypeDisplayName(head, name, application),
      holdsFields: TYPE_WITH_FIELDS_PATTERN.test(head),
      isInput: INPUT_TYPE_PATTERN.test(head),
    };
  }
}
