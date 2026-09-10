import { namesAType } from "../../../../../inputs/source/names/NamingConventions.mjs";

const LOWER_CASE_LETTER_PATTERN = /[a-z]/;

const namesATypeNotAConstant = name => namesAType(name) && LOWER_CASE_LETTER_PATTERN.test(name);

const isEnclosedByAType = enclosing => namesAType(enclosing || "");

const namesATypeInsideAnother = (enclosing, bare) => isEnclosedByAType(enclosing) && namesATypeNotAConstant(bare) && bare !== enclosing;

const aliasesANestedTypeByItsOwnName = found => found[1] === found[3] && namesATypeNotAConstant(found[3]);

export function findNestedAlias(line, form) {
  const found = form.exec(line);
  if (!found || !aliasesANestedTypeByItsOwnName(found)) return null;
  const [, , enclosing, bare] = found;
  return isEnclosedByAType(enclosing) ? { enclosing, bare } : null;
}

export function findNestedImport(line, { aliasForm = null, importForm, readEnclosing: enclosingOf, bareAt }) {
  const alias = aliasForm ? findNestedAlias(line, aliasForm) : null;
  if (alias) return alias;
  const found = importForm.exec(line);
  if (!found) return null;
  const enclosing = enclosingOf(found);
  const bare = found[bareAt];
  return namesATypeInsideAnother(enclosing, bare) ? { enclosing, bare } : null;
}
