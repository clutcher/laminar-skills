import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class KotlinCallEffects extends GenericCallEffects {
  language = "kotlin";
  ambientSources = [];
  typesWhoseStaticCallsHideNothing = ["Pair"];
  inMemoryTypes = ["MutableList", "MutableMap", "MutableSet", "Sequence", "Array"];
  inMemoryCallees = [];
  loopCallees = ["forEachIndexed", "mapNotNull", "mapIndexed", "flatMapConcat", "filterNot", "fold", "associate", "associateBy", "associateWith", "groupBy", "sumOf", "onEach"];
  objectProtocolCallees = [];
}
