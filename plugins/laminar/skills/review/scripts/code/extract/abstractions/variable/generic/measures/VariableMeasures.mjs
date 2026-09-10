import { countBranches } from "../../../method/generic/measures/MethodMeasures.mjs";

export function measureVariable(...declarationLines) {
  return {
    stepCount: 1,
    ...countBranches(declarationLines),
  };
}
