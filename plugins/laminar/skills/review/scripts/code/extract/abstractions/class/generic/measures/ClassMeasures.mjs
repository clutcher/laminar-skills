import { countBranches } from "../../../method/generic/measures/MethodMeasures.mjs";
import { splitDeclarationHead } from "../../../method/generic/signatures/MethodSignatures.mjs";

export function measureClass(declarationLines, memberCount) {
  const { bodyLines } = splitDeclarationHead(declarationLines);
  return {
    stepCount: memberCount,
    ...countBranches(bodyLines),
  };
}
