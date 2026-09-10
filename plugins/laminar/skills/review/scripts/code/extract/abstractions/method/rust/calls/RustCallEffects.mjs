import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class RustCallEffects extends GenericCallEffects {
  language = "rust";
  ambientSources = [];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = ["Vec", "VecDeque", "BTreeMap", "BTreeSet", "Option", "Result", "Cell", "RefCell", "Mutex", "RwLock"];
  inMemoryCallees = ["clone"];
  loopCallees = ["for_each", "filter_map", "flat_map"];
  objectProtocolCallees = [];
}
