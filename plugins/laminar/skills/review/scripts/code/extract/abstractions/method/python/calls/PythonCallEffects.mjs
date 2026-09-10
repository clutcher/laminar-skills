import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class PythonCallEffects extends GenericCallEffects {
  language = "python";
  ambientSources = [/\bdatetime\.(now|utcnow)\s*\(/, /\bos\.environ\b/];
  typesWhoseStaticCallsHideNothing = [];
  inMemoryTypes = ["list", "dict", "set", "tuple", "str", "frozenset", "defaultdict", "OrderedDict", "Counter", "deque", "bytes", "bytearray", "int", "float", "bool", "Mapping", "MutableMapping", "Dict", "Tuple"];
  inMemoryCallees = ["append", "extend", "pop", "strip", "lstrip", "rstrip", "replace", "split", "join", "lower", "upper", "format", "setdefault", "copy", "startswith", "endswith", "keys", "values", "items"];
  loopCallees = [];
  objectProtocolCallees = [];
}
