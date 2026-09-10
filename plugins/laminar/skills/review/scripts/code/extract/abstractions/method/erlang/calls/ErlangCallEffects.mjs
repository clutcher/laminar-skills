import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class ErlangCallEffects extends GenericCallEffects {
  language = "erlang";
  ambientSources = [];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = [];
  inMemoryCallees = [];
  loopCallees = ["foldl", "foldr", "foreach", "filtermap"];
  objectProtocolCallees = [];
}
