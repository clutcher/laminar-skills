import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class TypeScriptCallEffects extends GenericCallEffects {
  language = "javascript";
  ambientSources = [/\bnew\s+Date\s*\(/, /\bDate\.now\s*\(/, /\bprocess\.env\b/, /\bMath\.random\s*\(/];
  typesWhoseStaticCallsHideNothing = ["JSON", "Object", "Array", "Number", "Promise", "Error", "Math", "String", "Boolean", "Map", "Set"];
  inMemoryTypes = ["Record", "WeakMap", "WeakSet", "ReadonlyArray", "ReadonlyMap", "URLSearchParams", "Map", "Set", "Array", "Object", "String", "Number", "Boolean", "RegExp", "Date", "Error", "Promise", "JSON", "Math"];
  inMemoryCallees = ["push", "pop", "replace", "split", "join", "startsWith", "endsWith", "includes", "indexOf", "trim", "toLowerCase", "toUpperCase", "substring", "slice", "splice", "keys", "values", "entries"];
  loopCallees = ["forEach", "map", "flatMap", "filter", "reduce", "concatMap"];
  objectProtocolCallees = [];
}
