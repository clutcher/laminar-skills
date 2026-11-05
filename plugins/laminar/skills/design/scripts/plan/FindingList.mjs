import { readList, readOldTypeName } from "../model/DesignModel.mjs";

// The scales whose findings the model closes; a finding at the method or the variable scale becomes an entry of findings.json and a finding step.
export const PLAN_SCALES = new Set(["application", "module", "class"]);

const FIRST_GROUP = 1;

const METHOD_MARK = "#";

// The review prints a variable as `<name> in <enclosing>`, so the enclosing abstraction follows this mark.
const ENCLOSING_MARK = " in ";

const VARIABLE_SCALE = "variable";

// A finding names a method as Class#method, a local variable as name in Class#method, and a field as Class#field at the variable scale.
export const readFindingNamePieces = (displayName, scale) => {
  const enclosingAt = displayName.indexOf(ENCLOSING_MARK);
  const enclosing = enclosingAt >= 0 ? displayName.slice(enclosingAt + ENCLOSING_MARK.length) : displayName;
  const methodAt = enclosing.indexOf(METHOD_MARK);
  const className = methodAt >= 0 ? enclosing.slice(0, methodAt) : enclosing;
  const memberName = methodAt >= 0 ? enclosing.slice(methodAt + 1) : "";
  const isAField = scale === VARIABLE_SCALE && enclosingAt < 0;
  return { variableName: enclosingAt >= 0 ? displayName.slice(0, enclosingAt) : "", className, methodName: isAField ? "" : memberName, fieldName: isAField ? memberName : "" };
};

const isTheTypeOfTheName = (typeName, className) => typeName === className || typeName.endsWith(`.${className}`);

// The review names the class by its name in the current tree, so a class the model renames by oldName is found by its old name too.
const isTheClassOfTheName = (theClass, className) => isTheTypeOfTheName(theClass.name, className) || Boolean(theClass.oldName) && isTheTypeOfTheName(readOldTypeName(theClass), className);

// The review names a nested type by its own name, so the class of the model in the file of the finding wins over a class of the same name in another file.
export const findClassOfTheFinding = (model, displayName, scale, file) => {
  const { className } = readFindingNamePieces(displayName, scale);
  const inTheFile = model.classes.filter(theClass => theClass.file === file && isTheClassOfTheName(theClass, className));
  if (inTheFile.length === 1) return inTheFile[0];

  const ofTheName = model.findClass(className);
  return ofTheName && (!file || ofTheName.file === file) ? ofTheName : null;
};

export const getGroupOfTheClass = theClass => (Number.isFinite(theClass.group) ? theClass.group : FIRST_GROUP);

const findGroupOfTheFinding = (model, theClass, file) => {
  if (theClass) return getGroupOfTheClass(theClass);
  const classOfTheFile = model.classes.find(other => other.file === file);
  return classOfTheFile ? getGroupOfTheClass(classOfTheFile) : null;
};

// The file of a finding, from its first place with a line, so a finding on a class that the model does not hold, such as a test class, still names its file.
const readFileOfTheFinding = finding => {
  const place = finding.places.find(other => other.file && other.line !== null);
  return place ? place.file : "";
};

export const buildItemNumberOfFindingMap = run => new Map(run.items.flatMap(item => item.findings.map(finding => [finding.index, item.number])));

// 1 entry per finding of the run at the method and variable scales, with the migration group of its class and the decision of the decided list where it holds one.
export const listFindingEntries = (model, run, decisionOfFindingMap) => {
  const itemNumberOfFindingMap = buildItemNumberOfFindingMap(run);
  return readList(run.findings)
    .filter(finding => !PLAN_SCALES.has(finding.scale))
    .map(finding => {
      const file = readFileOfTheFinding(finding);
      const theClass = findClassOfTheFinding(model, finding.displayName, finding.scale, file);
      const decision = decisionOfFindingMap.get(finding.index);
      return {
        number: itemNumberOfFindingMap.get(finding.index) ?? null,
        check: finding.check,
        displayName: finding.displayName,
        scale: finding.scale,
        file,
        testCode: finding.testCode,
        group: findGroupOfTheFinding(model, theClass, file),
        ...(finding.toConsider ? { toConsider: true } : {}),
        ...(decision ? decision : {}),
      };
    });
};
