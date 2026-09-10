import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class SchemeCallEffects extends GenericCallEffects {
  language = "scheme";
  ambientSources = [];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = [];
  inMemoryCallees = [];
  loopCallees = ["for-each", "map", "filter"];
  objectProtocolCallees = [];
}
