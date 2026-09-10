import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class CSharpCallEffects extends GenericCallEffects {
  language = "csharp";
  ambientSources = [/\bDateTime\.(Now|UtcNow)\b/, /\bEnvironment\.GetEnvironmentVariable\s*\(/, /\bnew\s+Random\s*\(/];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = ["IEnumerable", "IList", "ICollection", "IDictionary", "Dictionary", "IReadOnlyList", "IReadOnlyCollection", "IReadOnlyDictionary", "SortedDictionary", "ConcurrentDictionary", "ImmutableArray", "Span", "Memory"];
  inMemoryCallees = [];
  loopCallees = ["Select", "SelectMany", "Where", "ForEach", "ForEachAsync"];
  objectProtocolCallees = [];
}
