import { isACodeLineCarryingAMark } from "../../../../../inputs/source/lines/LineKinds.mjs";

const NOT_FOUND = -1;

export const declaresFrameworkMarksOrDependencies = strategy => Boolean(strategy.framework && (strategy.dependencyLinePatterns || strategy.frameworkMarkPatterns));

export const findDependencyLineNamingTheFramework = (strategy, dependencyLines) => (strategy.dependencyLinePatterns ? dependencyLines.find(text => strategy.dependencyLinePatterns.some(pattern => pattern.test(text))) : undefined);

export const findIndexOfFirstLineMarkingTheFramework = (strategy, lines) => (strategy.frameworkMarkPatterns ? lines.findIndex(text => isACodeLineCarryingAMark(text, strategy.frameworkMarkPatterns)) : NOT_FOUND);
