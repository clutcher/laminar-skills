import { BLANK_PATTERN_SOURCE } from "../../forms/FunctionNamePatterns.mjs";

const GRAPHQL_FUNCTION_NAME_PATTERN_SOURCE = `^${BLANK_PATTERN_SOURCE}*((extend${BLANK_PATTERN_SOURCE}+)?(type|input|enum|interface|union|scalar|schema|directive)(${BLANK_PATTERN_SOURCE}|[{]|$).*)`;

export const GraphQLLanguage = Object.freeze({
  diffDriver: "graphql",
  extensions: [".graphql", ".graphqls", ".gql"],
  commentForms: Object.freeze({ lineForms: ["#"], blockForms: [] }),
  functionNamePattern: GRAPHQL_FUNCTION_NAME_PATTERN_SOURCE,
});
