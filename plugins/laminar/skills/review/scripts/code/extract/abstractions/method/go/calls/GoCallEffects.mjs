import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class GoCallEffects extends GenericCallEffects {
  language = "golang";
  ambientSources = [/\btime\.Now\s*\(/, /\bos\.Getenv\s*\(/, /\brand\.(Int|Float|Read)/];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = ["map", "error", "sync.Map", "strings.Builder", "bytes.Buffer", "Builder", "Buffer", "RWMutex"];
  inMemoryCallees = ["append"];
  loopCallees = [];
  objectProtocolCallees = [];
}
