import { WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../inputs/source/names/LanguageWords.mjs";
import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

const METHOD_REFERENCE_PATTERN = /([A-Za-z_$][\w$]*)::([A-Za-z_$][\w$]*)(?![\w$])(?!\s*\()/g;

const CONSTRUCTOR_WORD = "new";

const readTypeNamedBy = (qualifier, method) => (WORDS_FOR_THE_ENCLOSING_TYPE.has(qualifier) ? method.enclosingTypeName : qualifier);

export class JavaMethodRelationFinder extends GenericMethodRelationFinder {
  language = "java";
  methodHeads = "typed";
  callsOwnMembersBare = true;
  typesInFolderAreInScope = true;
  cStyleCasts = true;

  findMethodReferences(method, lines, callGraph) {
    const found = [];
    for (let line = method.line; line <= method.to; line++) {
      for (const [, qualifier, name] of String(lines[line - 1] || "").matchAll(METHOD_REFERENCE_PATTERN)) {
        if (name === CONSTRUCTOR_WORD) continue;
        const typeName = readTypeNamedBy(qualifier, method);
        const targets = callGraph.methods.filter(method => method.enclosingTypeName === typeName && method.name === name).map(method => method.id);
        if (targets.length === 1) found.push({ line, callee: name, targets });
      }
    }
    return found;
  }
}
