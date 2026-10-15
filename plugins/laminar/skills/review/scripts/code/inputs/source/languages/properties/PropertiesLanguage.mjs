import { createForms } from "../../forms/CommentForms.mjs";
import { KEY_TREE_FAMILY } from "../../keys/KeyPaths.mjs";
import { readPropertiesKeyLines } from "./PropertiesKeyLines.mjs";

export const PropertiesLanguage = Object.freeze({
  diffDriver: "properties",
  extensions: [".properties"],
  family: KEY_TREE_FAMILY,
  commentForms: createForms(["#", "!"]),
  holdsKeyTrees: true,
  readKeyLines: readPropertiesKeyLines,
});
