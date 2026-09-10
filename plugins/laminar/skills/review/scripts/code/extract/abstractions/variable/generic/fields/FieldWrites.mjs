import { escapeForAPattern } from "../../../../../inputs/source/text/PatternText.mjs";

const capitalize = name => name.charAt(0).toUpperCase() + name.slice(1);

export const buildFieldWritePattern = name => new RegExp(`\\.set${escapeForAPattern(capitalize(name))}\\s*\\(|\\.${escapeForAPattern(name)}\\s*\\(\\s*[^)\\s]|(?<![\\w$.])${escapeForAPattern(name)}\\s*[:=](?![=>])`);
