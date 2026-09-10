import { CLASS_FINDER_REGISTRY } from "../abstractions/class/index.mjs";
import { MODULE_FINDER_REGISTRY } from "../abstractions/module/index.mjs";
import { GENERIC_CALL_EFFECTS, LANGUAGE_CALL_EFFECTS, METHOD_FINDER_REGISTRY } from "../abstractions/method/index.mjs";
import { VARIABLE_FINDER_REGISTRY } from "../abstractions/variable/index.mjs";
import { FinderContext } from "./FinderContext.mjs";

const createContext = diffDriver => FinderContext.createForLanguage(diffDriver);

export const findMethodFinder = diffDriver => METHOD_FINDER_REGISTRY.findWalkingFinder(createContext(diffDriver));

export const findMethodRelationFinder = diffDriver => METHOD_FINDER_REGISTRY.findRelationFinder(createContext(diffDriver));

const callEffectsByLanguageMap = new Map();

const findCallEffectsOf = diffDriver => LANGUAGE_CALL_EFFECTS.find(effects => createContext(diffDriver).admits(effects)) || GENERIC_CALL_EFFECTS;

export function readCallEffects(diffDriver) {
  if (!callEffectsByLanguageMap.has(diffDriver)) callEffectsByLanguageMap.set(diffDriver, findCallEffectsOf(diffDriver));
  return callEffectsByLanguageMap.get(diffDriver);
}

export const findModuleRelationFinder = diffDriver => MODULE_FINDER_REGISTRY.findRelationFinder(createContext(diffDriver));

export const readImportConventions = diffDriver => findModuleRelationFinder(diffDriver).importConventions;

export const readPackageScope = diffDriver => findModuleRelationFinder(diffDriver).packageScope;

const joinedModuleFindersByContextKeyMap = new Map();

export function getOrJoinModuleFinder(diffDriver, frameworks = []) {
  const language = MODULE_FINDER_REGISTRY.findFinder(createContext(diffDriver));
  if (!language) return MODULE_FINDER_REGISTRY.generic;
  const context = new FinderContext({ language: diffDriver, frameworks });
  if (!joinedModuleFindersByContextKeyMap.has(context.key)) {
    joinedModuleFindersByContextKeyMap.set(context.key, language.joinFrameworks(MODULE_FINDER_REGISTRY.findFrameworkFinders(context), MODULE_FINDER_REGISTRY.findRoleFinders(context), MODULE_FINDER_REGISTRY.shapeFinders));
  }
  return joinedModuleFindersByContextKeyMap.get(context.key);
}

export const findVariableFinder = diffDriver => VARIABLE_FINDER_REGISTRY.findWalkingFinder(createContext(diffDriver));

export const findClassRelationFinder = diffDriver => CLASS_FINDER_REGISTRY.findRelationFinder(createContext(diffDriver));
