import { KINDS, OVERRIDE_KINDS, isAText, isMarkedUnchanged, readList, readOldTypeName } from "../model/DesignModel.mjs";
import { readMemberLanguage } from "./ClassDeclaration.mjs";
import { listDeclaredMethods } from "./DeclaredMethods.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";
import { readTreeFileOfTheClass } from "./LiteralTables.mjs";

// The map types of each language, by the head of the type name: each holds values by a key in its language, whatever the framework around it.
const MAP_TYPE_NAMES = new Set([
  // Java: the map interfaces and the maps of java.util and java.util.concurrent.
  "Map", "HashMap", "LinkedHashMap", "TreeMap", "SortedMap", "NavigableMap", "EnumMap", "WeakHashMap", "IdentityHashMap", "ConcurrentMap", "ConcurrentHashMap", "ConcurrentSkipListMap",
  // Kotlin: the changeable map of the standard library, beside Map, HashMap and LinkedHashMap, which it shares with Java.
  "MutableMap",
  // TypeScript: the map of the language, its read-only view and the object type keyed by Record.
  "ReadonlyMap", "Record",
  // Python: the built-in dict, its typing name and the dicts and mappings of collections and collections.abc.
  "dict", "Dict", "Mapping", "MutableMapping", "OrderedDict", "defaultdict", "Counter",
]);

// The head name of a type, after its annotations and its package or module path, where the name ends the type or type arguments follow.
const TYPE_HEAD = /^(?:@[\w.]+\s+)*(?:[\w$]+\.)*([\w$]+)\s*(?:[<[?]|$)/;

// A TypeScript object type keyed by an index signature, such as { [memberId: string]: Loan[] }.
const INDEX_SIGNATURE = /^\{\s*(?:readonly\s+)?\[\s*[\w$]+\s*:/;

const MAP_WORD = "map";

// The section of the skill code-style that holds the rule, as an object of decisions.conventions.overrides names it.
const NAMING_RULE_ID = /^code-style\s+naming\.md\s+§10$/;

const KINDS_THAT_WRITE_EVERY_NAME = new Set([KINDS.CREATED, KINDS.MOVED]);

const NAME_STATES = Object.freeze({ WRITTEN: "written", KEPT: "kept", UNKNOWN: "unknown" });

export const isAMapType = type => {
  const text = String(type || "").trim();
  const head = TYPE_HEAD.exec(text);
  return INDEX_SIGNATURE.test(text) || (head !== null && MAP_TYPE_NAMES.has(head[1]));
};

const readLastNameWord = name => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_]+/).filter(Boolean).pop() || "";

const endsInTheMapWord = name => readLastNameWord(name).toLowerCase().endsWith(MAP_WORD);

const isOverriddenByTheProject = model => readList(model.decisions.conventions?.overrides)
  .some(override => override.kind === OVERRIDE_KINDS.OVERRIDE && NAMING_RULE_ID.test(String(override.codeStyle || "").trim()));

const readCurrentTypeName = theClass => (isAText(theClass.oldName) ? readOldTypeName(theClass) : theClass.name);

// Whether the current file of the class declares the method; unknown in a language whose declarations the check does not read.
const findTheNameStateInTheTree = (model, theClass, method, currentTree) => {
  const file = readTreeFileOfTheClass(model, theClass);
  if (!readMemberLanguage(file)) return NAME_STATES.UNKNOWN;

  const text = currentTree.readFileText(file);
  const declaredMethods = isAText(text) ? listDeclaredMethods(text, file, readCurrentTypeName(theClass)) : null;
  return declaredMethods && declaredMethods.some(declared => declared.name === method.name) ? NAME_STATES.KEPT : NAME_STATES.WRITTEN;
};

// The change writes the name of a method of a created or moved file, or with an oldName; another name stands in the base where the current file declares it, and is unknown with no current tree.
const findTheNameState = (model, theClass, method, currentTree) => {
  if (KINDS_THAT_WRITE_EVERY_NAME.has(model.getKindOfClass(theClass)) || isAText(method.oldName)) return NAME_STATES.WRITTEN;
  if (!currentTree) return NAME_STATES.UNKNOWN;
  return findTheNameStateInTheTree(model, theClass, method, currentTree);
};

const describeTheName = (displayName, returns) => `${displayName} returns ${returns}, values held by a key, and its last name word does not end in map; keep the words that say what it holds, and name the values, then the key, and end with the word map, by code-style naming.md §10`;

const describeTheKeptName = (displayName, returns) => `${describeTheName(displayName, returns)}; the name may stand in the current code, which the check did not read`;

// A method that returns a map and whose name the change writes must end in map, a rule of the skill code-style narrower than the book, which a project override of its section clears. A name the check cannot place in the change or the base is a recheck case.
export const findCollectionNameDefects = (model, currentTree) => {
  if (isOverriddenByTheProject(model)) return [];

  const defects = [];
  for (const theClass of model.classes) {
    if (!model.isChangedClass(theClass)) continue;

    for (const method of readList(theClass.methods)) {
      if (isMarkedUnchanged(method) || !isAText(method.name) || !isAMapType(method.returns) || endsInTheMapWord(method.name)) continue;

      const nameState = findTheNameState(model, theClass, method, currentTree);
      const displayName = model.getMethodDisplayName(theClass, method);
      const methodPath = `${model.getMethodPath(theClass, method)}.name`;
      if (nameState === NAME_STATES.WRITTEN) defects.push(createDefect(DEFECT_CODES.MAP_NAME_WITHOUT_MAP_ENDING, methodPath, describeTheName(displayName, method.returns)));
      else if (nameState === NAME_STATES.UNKNOWN) defects.push(createRecheckDefect(DEFECT_CODES.MAP_NAME_WITHOUT_MAP_ENDING, methodPath, describeTheKeptName(displayName, method.returns)));
    }
  }
  return defects;
};
