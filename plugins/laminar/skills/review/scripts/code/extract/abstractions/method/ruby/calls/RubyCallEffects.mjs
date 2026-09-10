import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class RubyCallEffects extends GenericCallEffects {
  language = "ruby";
  ambientSources = [];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = [];
  inMemoryCallees = [];
  loopCallees = ["each", "each_with_index", "each_with_object", "each_slice", "collect", "select", "reject", "flat_map", "filter_map", "times", "map"];
  objectProtocolCallees = [];
}
