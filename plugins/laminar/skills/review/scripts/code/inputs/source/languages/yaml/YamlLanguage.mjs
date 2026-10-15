import { HASH_ONLY } from "../../forms/CommentForms.mjs";
import { KEY_TREE_FAMILY } from "../../keys/KeyPaths.mjs";
import { readYamlKeyLines } from "./YamlKeyLines.mjs";

export const YamlLanguage = Object.freeze({
  diffDriver: "yaml",
  extensions: [".yml", ".yaml"],
  family: KEY_TREE_FAMILY,
  commentForms: HASH_ONLY,
  holdsKeyTrees: true,
  readKeyLines: readYamlKeyLines,
});
