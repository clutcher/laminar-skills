import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class ScalaCallEffects extends GenericCallEffects {
  language = "scala";
  ambientSources = [];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = [];
  inMemoryCallees = [];
  loopCallees = ["foreach", "map", "flatMap", "filter", "foldl", "foldr"];
  objectProtocolCallees = [];
}
