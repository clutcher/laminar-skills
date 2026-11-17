import { readCheckIds, readDisplayNameOfTheFinding, readScale } from "./DecidedResults.mjs";

// The 2 rules that relate an open result to a decision of another key; a relation never sets a result apart and never changes its status.
export const RELATION = Object.freeze({ SIBLING: "sibling", MEMBER_AND_CLASS: "memberAndClass" });

const CLASS_SCALE = "class";

const METHOD_SCALE = "method";

const VARIABLE_SCALE = "variable";

const MEMBER_MARK = "#";

const ENCLOSING_MARK = " in ";

// A member is a method, or a field: a variable whose display name holds the member mark and no enclosing method.
const isAMember = (displayName, scale) => scale === METHOD_SCALE || (scale === VARIABLE_SCALE && displayName.includes(MEMBER_MARK) && !displayName.includes(ENCLOSING_MARK));

const readScaleOfTheAbstraction = abstraction => String(abstraction.scale || "").toLowerCase();

const isAClassOfTheTree = abstraction => Boolean(abstraction) && readScaleOfTheAbstraction(abstraction) === CLASS_SCALE;

// Each abstraction of the tree with the class the tree lists it under, the nearest class above it.
const listTheTreeWithItsClass = (abstractions, enclosingClass) => abstractions.flatMap(abstraction => [
  { abstraction, enclosingClass },
  ...listTheTreeWithItsClass(abstraction.children || [], isAClassOfTheTree(abstraction) ? abstraction : enclosingClass),
]);

const holdsTheSpan = (theClass, member) => Boolean(theClass.lines && member.lines)
  && theClass.path === member.path
  && theClass.lines.from <= member.lines.from
  && theClass.lines.to >= member.lines.to;

const readSpanLength = theClass => theClass.lines.to - theClass.lines.from;

// The tree lists the members of a nested type under the type around it, so the class whose span in the same file holds the member's span most closely declares it; the class the tree nests it under where no span tells.
const findTheDeclaringClass = (member, enclosingClass, classes) => {
  const holding = classes.filter(theClass => holdsTheSpan(theClass, member)).sort((first, second) => readSpanLength(first) - readSpanLength(second));
  return holding.length ? holding[0] : enclosingClass;
};

// The key of 1 abstraction of the tree: its file, its scale and its display name, because 2 files may hold 1 name.
const createTreeKey = (file, scale, displayName) => `${file}\t${scale}\t${displayName}`;

// The tree of a run folder read for relations: the class that declares each member and the class each class is nested in, by the nesting and the spans of the tree, never by the text of a display name.
export const readClassOfTreeKeyMap = abstractions => {
  const listed = listTheTreeWithItsClass(abstractions || [], null);
  const classes = listed.map(({ abstraction }) => abstraction).filter(isAClassOfTheTree);
  const classOfTreeKeyMap = new Map();
  for (const { abstraction, enclosingClass } of listed) {
    const scale = readScaleOfTheAbstraction(abstraction);
    const displayName = String(abstraction.displayName || "");
    const key = createTreeKey(String(abstraction.path || ""), scale, displayName);
    if (isAClassOfTheTree(abstraction)) classOfTreeKeyMap.set(key, { theClass: abstraction, declaringClass: null, outerClass: enclosingClass });
    else if (isAMember(displayName, scale)) classOfTreeKeyMap.set(key, { theClass: null, declaringClass: findTheDeclaringClass(abstraction, enclosingClass, classes), outerClass: null });
  }
  return classOfTreeKeyMap;
};

const listNamesOfTheDecision = decision => [decision.displayName, ...(decision.formerNames || [])];

const readFileOfTheDecision = decision => String(decision.file || "");

const findInTheTree = (classOfTreeKeyMap, file, scale, names) => names.map(name => classOfTreeKeyMap.get(createTreeKey(file, scale, name))).find(Boolean) || null;

// The class that declares a decided member in the tree of this run, else the class the design model gave it, which counts only in the file of the decision.
const findDeclaringClassOfTheDecision = (decision, classOfTreeKeyMap) => {
  const file = readFileOfTheDecision(decision);
  const listed = findInTheTree(classOfTreeKeyMap, file, decision.scale, listNamesOfTheDecision(decision));
  if (listed) return listed.declaringClass;
  return decision.classDisplayName ? { displayName: decision.classDisplayName, path: file } : null;
};

const isTheClass = (theClass, other) => Boolean(theClass) && Boolean(other) && theClass.path === other.path && theClass.displayName === other.displayName;

// The simple name of a nested type: its own name in the tree, else its display name after the display name of the class the tree nests it in.
const readSimpleTypeName = ({ theClass, outerClass }) => {
  if (theClass.name) return String(theClass.name);
  const outerPrefix = `${outerClass.displayName}.`;
  const displayName = String(theClass.displayName || "");
  return displayName.startsWith(outerPrefix) ? displayName.slice(outerPrefix.length) : "";
};

const isANestedType = listed => Boolean(listed && listed.theClass) && isAClassOfTheTree(listed.outerClass);

// 2 classes the tree nests in another class, each a nested type, with 1 simple name.
const areNestedTypesOfOneSimpleName = (listed, decidedListed) => isANestedType(listed)
  && isANestedType(decidedListed)
  && readSimpleTypeName(listed) !== ""
  && readSimpleTypeName(listed) === readSimpleTypeName(decidedListed);

// 2 members of 1 declaring class in 1 file at the same scale, or 2 nested types at class scale with 1 simple name.
const isASibling = (decision, finding, name, scale, classOfTreeKeyMap) => {
  if (scale !== decision.scale) return false;
  if (isAMember(name, scale) && isAMember(decision.displayName, decision.scale)) {
    const listed = classOfTreeKeyMap.get(createTreeKey(String(finding.file || ""), scale, name));
    return Boolean(listed) && isTheClass(listed.declaringClass, findDeclaringClassOfTheDecision(decision, classOfTreeKeyMap));
  }
  if (scale !== CLASS_SCALE) return false;
  return areNestedTypesOfOneSimpleName(classOfTreeKeyMap.get(createTreeKey(String(finding.file || ""), scale, name)), findInTheTree(classOfTreeKeyMap, readFileOfTheDecision(decision), CLASS_SCALE, listNamesOfTheDecision(decision)));
};

// A member and the class or record that declares it, in 1 file, in either direction.
const isAMemberAndItsClass = (decision, finding, name, scale, classOfTreeKeyMap) => {
  const file = String(finding.file || "");
  if (isAMember(decision.displayName, decision.scale) && scale === CLASS_SCALE) return isTheClass(findDeclaringClassOfTheDecision(decision, classOfTreeKeyMap), { path: file, displayName: name });
  if (decision.scale !== CLASS_SCALE || !isAMember(name, scale)) return false;

  const listed = classOfTreeKeyMap.get(createTreeKey(file, scale, name));
  return Boolean(listed && listed.declaringClass)
    && listed.declaringClass.path === readFileOfTheDecision(decision)
    && listNamesOfTheDecision(decision).includes(listed.declaringClass.displayName);
};

// The relation of 1 open result to 1 decision, read from the 2 keys and the tree of the run, or "" where none holds; a decision of the result's own key relates nothing, because the key match handles it, also where it expired.
export const findRelationToTheDecision = (decision, finding, classOfTreeKeyMap) => {
  // A reach decision relates nothing: the person already chose which keys the ruling reaches, and its key has no reach of its own to add to.
  if (decision.reachOf) return "";
  if (!readCheckIds(finding).includes(decision.check)) return "";

  const name = readDisplayNameOfTheFinding(finding);
  const scale = readScale(finding);
  if (scale === decision.scale && listNamesOfTheDecision(decision).includes(name)) return "";
  if (isASibling(decision, finding, name, scale, classOfTreeKeyMap)) return RELATION.SIBLING;
  return isAMemberAndItsClass(decision, finding, name, scale, classOfTreeKeyMap) ? RELATION.MEMBER_AND_CLASS : "";
};

const createDecisionKey = decision => `${decision.check}\t${decision.scale}\t${decision.displayName}`;

const keepTheFirstOfEachKey = related => {
  const keys = new Set();
  return related.filter(({ decision }) => {
    const key = createDecisionKey(decision);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
};

// The decisions related to the open results of a review, each decision once per result, in the order of the decided review file.
export class RelatedDecisions {
  constructor(decisions, openFindings, classOfTreeKeyMap) {
    this.relatedOfFindingMap = new Map();
    for (const finding of openFindings) {
      const related = decisions
        .map(decision => ({ decision, relation: findRelationToTheDecision(decision, finding, classOfTreeKeyMap) }))
        .filter(relatedDecision => relatedDecision.relation);
      if (related.length) this.relatedOfFindingMap.set(finding, keepTheFirstOfEachKey(related));
    }
  }

  listRelatedOfTheFinding(finding) {
    return this.relatedOfFindingMap.get(finding) || [];
  }

  // The related decisions of the findings of 1 item, each decision once.
  listRelatedOfTheFindings(findings) {
    return keepTheFirstOfEachKey(findings.flatMap(finding => this.listRelatedOfTheFinding(finding)));
  }
}
