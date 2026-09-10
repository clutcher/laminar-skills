import { findInlineTestRegions, isTestPath } from "../../inputs/source/TestCode.mjs";
import { doesSpanHoldLine } from "../../graph/abstractions/Place.mjs";
import { Evidence, EVIDENCE_KINDS } from "../../graph/Evidence.mjs";
import { ROLE_KINDS } from "../../graph/abstractions/Role.mjs";
import { CLASS_FINDER_REGISTRY } from "../abstractions/class/index.mjs";
import { METHOD_FINDER_REGISTRY } from "../abstractions/method/index.mjs";
import { MARK_FORMS } from "../../inputs/source/declarations/MarkedDeclarations.mjs";
import { readTestFrictionFacts } from "../abstractions/method/generic/testing/TestFrictionFacts.mjs";
import { collectTestHeadFacts } from "../abstractions/method/generic/testing/TestKinds.mjs";
import { findTypeRouteAbove } from "../abstractions/class/generic/routes/TypeRoutes.mjs";

const TESTS_FOUND_BY = "AbstractionTree";

const KIND_ORDER = Object.freeze([ROLE_KINDS.ENTRY_BOUNDARY, ROLE_KINDS.APPLICATION_START]);

const FORM_ORDER = Object.freeze([MARK_FORMS.ANNOTATION, MARK_FORMS.ROUTE, MARK_FORMS.SCHEMA_MAPPING]);

const ofTheFile = null;

class RolesOfASource {
  constructor(declarations) {
    this.declarations = declarations;
    this.byDeclaration = declarations.map(() => new Map());
    this.fileRolesByKindMap = new Map();
  }

  give(roles, kind, roleFields) {
    const givenRole = roles.get(kind);
    roles.set(kind, givenRole ? { ...givenRole, detail: givenRole.detail || roleFields.detail, facts: { ...givenRole.facts, ...roleFields.facts } } : { kind, detail: "", facts: {}, ...roleFields });
  }

  giveTo(declaration, kind, roleFields) {
    this.give(declaration === ofTheFile ? this.fileRolesByKindMap : this.byDeclaration[this.declarations.indexOf(declaration)], kind, roleFields);
  }

  convertToData() {
    return { declarations: this.byDeclaration.map(roles => [...roles.values()]), file: [...this.fileRolesByKindMap.values()] };
  }
}

const selectEarliest = found => found.reduce((earliest, role) => (role.line < earliest.line ? role : earliest));

function keepTheEarliestPerTargetKindAndForm(found) {
  const rolesByTargetMap = new Map();
  for (const role of found) {
    if (!rolesByTargetMap.has(role.of)) rolesByTargetMap.set(role.of, new Map());
    const rolesByFormMap = rolesByTargetMap.get(role.of);
    const key = `${role.kind}|${role.form}`;
    rolesByFormMap.set(key, rolesByFormMap.has(key) ? selectEarliest([rolesByFormMap.get(key), role]) : role);
  }
  return [...rolesByTargetMap.values()].flatMap(rolesByFormMap => [...rolesByFormMap.values()]);
}

const compareInTheOrderGiven = (left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) || FORM_ORDER.indexOf(left.form) - FORM_ORDER.indexOf(right.form);

function buildEarliestTypeRouteReader(classFinders, lines) {
  return type => {
    if (!type) return "";
    const routes = classFinders.map(finder => findTypeRouteAbove(finder, lines, type.line)).filter(Boolean);
    return routes.length ? selectEarliest(routes).route : "";
  };
}

function buildTheTestKindReading(source, methodFinders) {
  const driver = source.driver;
  return {
    testOpeners: methodFinders.flatMap(finder => finder.testCodeMarks.testOpeners),
    hookMarks: methodFinders.flatMap(finder => finder.testCodeMarks.hookMarks),
    isATestCall: declaration => Boolean(driver.readDeclaration(declaration.text).isATestCall),
    isAConstructor: declaration => Boolean(declaration.scope) && (declaration.name === declaration.scope || driver.isAConstructor(declaration)),
  };
}

function readTests(roles, declarations, source, lines, methodFinders, context) {
  if (isTestPath(source.path)) {
    roles.giveTo(ofTheFile, ROLE_KINDS.TEST, {
      evidence: new Evidence({ kind: EVIDENCE_KINDS.CONVENTION, foundBy: TESTS_FOUND_BY, detail: "a test path" }),
      facts: {
        frameworks: [...context.frameworks],
        ...readTestFrictionFacts(lines, methodFinders),
        ...collectTestHeadFacts(declarations, lines, buildTheTestKindReading(source, methodFinders)),
      },
    });
  }
  for (const region of findInlineTestRegions(source.path, source.lines)) {
    for (const declaration of declarations.filter(declaration => doesSpanHoldLine(region, declaration.line))) {
      roles.giveTo(declaration, ROLE_KINDS.TEST, { evidence: new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: TESTS_FOUND_BY, detail: `an inline test region at lines ${region.from}-${region.to}` }) });
    }
  }
}

export function findRolesOfSource(source, declarations, lines, context) {
  const classFinders = CLASS_FINDER_REGISTRY.findRoleFinders(context);
  const methodFinders = METHOD_FINDER_REGISTRY.findRoleFinders(context);
  const file = { path: source.path, lines, declarations, readTypeRoute: buildEarliestTypeRouteReader(classFinders, lines) };
  const roles = new RolesOfASource(declarations);
  const found = keepTheEarliestPerTargetKindAndForm([...classFinders, ...methodFinders].flatMap(finder => finder.findRoles(file, source)));
  for (const { kind, of, form, line, ...roleFields } of found.sort(compareInTheOrderGiven)) roles.giveTo(of, kind, roleFields);
  readTests(roles, declarations, source, lines, methodFinders, context);
  return roles.convertToData();
}

const NO_LINES = Object.freeze([]);

export function findVisibleForTestingLines(source, lines, context) {
  if (isTestPath(source.path)) return NO_LINES;
  const methodFinders = METHOD_FINDER_REGISTRY.findRoleFinders(context);
  return [...new Set(methodFinders.flatMap(finder => finder.testCodeMarks.collectVisibleForTestingLines(lines)))].sort((left, right) => left - right);
}
