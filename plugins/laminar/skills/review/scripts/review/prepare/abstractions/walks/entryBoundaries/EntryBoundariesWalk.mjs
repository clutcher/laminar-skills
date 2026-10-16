import { findAddedLinesOfTheFile, isADecisionLine, readApplicationName, CHANGE_KINDS, changesTheCode, readDeclaredMemberChangeKind, findDeployableFolder, holdsAnAddedLine, findInnermostMethodAt, isAFileWithBehavior, isAnEntryBoundaryRole, isASchemaFile, isTestPath, readLanguageFamily, Scale, findTypesEnclosingTheSpanInnermostFirst } from "../../../../../code/index.mjs";
import { EntryBoundaryFills, MAX_SLICE_LINES, readNumberedLines } from "./EntryBoundaryFills.mjs";
import { EntryBoundaryCallers } from "./EntryBoundaryCallers.mjs";
import { SchemaTypes } from "./SchemaTypes.mjs";

export const ENTRY_BOUNDARY_KINDS = Object.freeze({ GRAPHQL_FIELD: "GraphQL field", REST_ENDPOINT: "REST endpoint" });

const readRemovedText = file => file.hunks.flatMap(hunk => hunk.removedLines).join("\n");

const wasDeclaredBeforeTheChange = (removedText, name) => new RegExp(`(?<![\\w$])${name}\\s*[(:]`).test(removedText);

const isAChangedProductionMethod = abstraction => abstraction.scale === Scale.METHOD.name && !abstraction.isTest && Boolean(abstraction.lines)
  && changesTheCode(abstraction.changeKind) && isAFileWithBehavior(abstraction.path);

const holdsTheLines = (abstraction, filePath, from, to) => abstraction.path === filePath && Boolean(abstraction.lines) && abstraction.lines.from <= to && from <= abstraction.lines.to;

const holdsTextAfterTheChange = file => file.existsAfterTheChange && file.holdsTheWholeText;

const MAX_OTHER_TYPE_LINES = 12;

const readTypeLines = type => {
  const lastField = type.fields[type.fields.length - 1];
  return readNumberedLines(type.lines, type.line, Math.min(lastField.to + 1, type.line + MAX_OTHER_TYPE_LINES - 1));
};

const readFieldLines = (lines, field) => readNumberedLines(lines, field.line, Math.min(field.to, field.line + MAX_SLICE_LINES - 1));

export const MAX_COMPARED_FIELDS = 4;

const EQUALITY = "(?:===|!==|==|!=)";

const MEMBER_PATH = "(?:[\\w$]+(?:\\(\\s*\\))?\\s*\\??\\.\\s*)*";

const READ_OF_THE_FIELD = "(?:\\(\\s*\\))?";

const buildComparisonPatterns = name => [
  new RegExp(`(?<![\\w$])${name}${READ_OF_THE_FIELD}\\s*${EQUALITY}`),
  new RegExp(`${EQUALITY}\\s*${MEMBER_PATH}${name}(?![\\w$])`),
  new RegExp(`(?<![\\w$])${name}${READ_OF_THE_FIELD}\\s*\\.\\s*equals\\s*\\(`),
  new RegExp(`(?<![\\w$])(?:switch|when|match)\\s*\\(?\\s*${MEMBER_PATH}${name}(?![\\w$])`),
];

const comparesTheField = (texts, name) => {
  const patterns = buildComparisonPatterns(name);
  return texts.some(text => patterns.some(pattern => pattern.test(text)));
};

const readDecisionTextsOfTheFills = fills => fills.flatMap(fill => [fill, ...(fill.conditionCalls || [])])
  .flatMap(fillOrConditionCall => fillOrConditionCall.lines || []).map(line => line.text).filter(isADecisionLine);

const readDecisionTextsOfTheCallers = callers => callers.flatMap(caller => caller.readPlaces || []).filter(place => place.decision)
  .flatMap(place => (place.lines || []).filter(line => line.line === place.line)).map(line => line.text);

const FIELD_ARGUMENTS_PATTERN = /\([^)]*\)/g;

const FIELD_TYPE_PATTERN = /:\s*([^@#=]+)/;

export const readFieldTypeText = fieldText => ((FIELD_TYPE_PATTERN.exec(String(fieldText).replace(FIELD_ARGUMENTS_PATTERN, "")) || [])[1] || "").trim();

export const readNamedTypeOf = typeText => typeText.replace(/[[\]!\s]/g, "");

export class EntryBoundariesWalk {
  constructor(repositoryText, testCode, change, roots, callGraphOf, references, codeGraph) {
    this.repositoryText = repositoryText;
    this.codeGraph = codeGraph;
    this.change = change;
    this.roots = roots;
    this.findCallGraph = callGraphOf;
    this.references = references;
    this.fills = new EntryBoundaryFills(repositoryText, testCode, callGraphOf, roots, references, codeGraph);
    this.callers = new EntryBoundaryCallers(repositoryText, testCode, callGraphOf, roots, references);
    this.addedByPathMap = change.readAddedLinesByPath();
    this.schemaTypes = new SchemaTypes(repositoryText, roots, codeGraph);
  }

  walkAbstractions(abstractions) {
    return [...this.buildGraphQlFields(abstractions), ...this.findRestEndpoints(abstractions)]
      .map(boundary => ({ ...boundary, abstractionIds: this.findAbstractionIds(boundary, abstractions) }));
  }

  findApplicationFolder(filePath) {
    return findDeployableFolder(filePath, this.roots);
  }

  findChangedSchemaFiles() {
    return this.change.files.filter(holdsTextAfterTheChange).filter(file => isASchemaFile(file.path, file.lines));
  }

  findFieldsChangedInTheSchema() {
    const selected = [];
    for (const file of this.findChangedSchemaFiles()) {
      const added = findAddedLinesOfTheFile(this.addedByPathMap, file.path);
      const removedText = readRemovedText(file);
      const types = this.schemaTypes.listSchemaTypesOfTheApplication(this.findApplicationFolder(file.path)).filter(type => type.path === file.path);
      for (const type of types) {
        for (const field of type.fields.filter(field => holdsAnAddedLine(added, field.line, field.to))) {
          selected.push({ type, field, changeKind: readDeclaredMemberChangeKind(wasDeclaredBeforeTheChange(removedText, field.name)) });
        }
      }
    }
    return selected;
  }

  collectWordsOfTheChange(applicationFolder, abstractions) {
    const words = new Set(abstractions.filter(isAChangedProductionMethod)
      .filter(abstraction => this.findApplicationFolder(abstraction.path) === applicationFolder).map(abstraction => abstraction.name));
    for (const file of this.change.files.filter(file => this.findApplicationFolder(file.path) === applicationFolder && !isTestPath(file.path))) {
      for (const { line } of file.hunks.flatMap(hunk => hunk.numberedAddedLines)) for (const name of this.references.lines.listEveryNameAtLine(file.path, line)) words.add(name);
    }
    return words;
  }

  fillChanged(fills) {
    return fills.some(fill => holdsAnAddedLine(findAddedLinesOfTheFile(this.addedByPathMap, fill.path), fill.from, fill.to));
  }

  collectChangedApplicationFolders() {
    return new Set(this.change.files.map(file => this.findApplicationFolder(file.path)).filter(folder => folder !== null));
  }

  findFieldsNamedByTheChange(applicationFolder, abstractions, alreadySelected) {
    const words = this.collectWordsOfTheChange(applicationFolder, abstractions);
    return this.schemaTypes.listSchemaTypesOfTheApplication(applicationFolder).flatMap(type => type.fields
      .filter(field => words.has(field.name) && !alreadySelected.has(field.displayName))
      .map(field => ({ type, field })));
  }

  scheduleFieldsWithAChangedFill(abstractions, alreadySelected) {
    const selected = [];
    for (const applicationFolder of this.collectChangedApplicationFolders()) {
      for (const { type, field } of this.findFieldsNamedByTheChange(applicationFolder, abstractions, alreadySelected)) {
        const fills = this.fills.fillsOf(field, type.name, applicationFolder);
        if (this.fillChanged(fills)) selected.push({ type, field, changeKind: CHANGE_KINDS.INTERNALS_CHANGED, fills });
      }
    }
    return selected;
  }

  findOtherTypesHolding(field, type, applicationFolder) {
    return this.schemaTypes.listSchemaTypesOfTheApplication(applicationFolder)
      .filter(other => other.displayName !== type.displayName && other.fields.some(otherField => otherField.name === field.name));
  }

  findOtherTypesNaming(field, type, applicationFolder) {
    return [...new Set(this.findOtherTypesHolding(field, type, applicationFolder).map(other => other.name))];
  }

  buildSchemaFieldReadings() {
    return this.findFieldsChangedInTheSchema().map(({ type, field }) => {
      const otherTypes = this.findOtherTypesHolding(field, type, this.findApplicationFolder(type.path));
      return {
        displayName: field.displayName,
        name: field.name,
        path: type.path,
        enclosingTypeDisplayName: type.displayName,
        otherTypes: otherTypes.map(other => ({ name: other.name, path: other.path, lines: readTypeLines(other) })),
      };
    });
  }

  findCallersOfField(type, field, applicationFolder) {
    return type.isInput
      ? this.callers.findInputFieldCallers(field.name, type.name, applicationFolder)
      : this.callers.findGraphQlCallers(field.name, applicationFolder);
  }

  buildComparedField(type, field, applicationFolder) {
    const fieldText = String(type.lines[field.line - 1] ?? "");
    const typeText = readFieldTypeText(fieldText);
    return {
      displayName: field.displayName,
      path: type.path,
      line: field.line,
      typeText,
      lines: [{ line: field.line, text: fieldText }],
      declaredType: this.schemaTypes.findDeclaredType(applicationFolder, readNamedTypeOf(typeText)),
    };
  }

  findComparedFields(boundaryField, applicationFolder, fills, callers) {
    const texts = [...readDecisionTextsOfTheFills(fills), ...readDecisionTextsOfTheCallers(callers)];
    if (!texts.length) return [];
    return this.schemaTypes.listSchemaTypesOfTheApplication(applicationFolder)
      .flatMap(type => type.fields.filter(field => comparesTheField(texts, field.name)).map(field => this.buildComparedField(type, field, applicationFolder)))
      .filter(comparedField => comparedField.declaredType || comparedField.displayName !== boundaryField.displayName)
      .slice(0, MAX_COMPARED_FIELDS);
  }

  buildGraphQlField({ type, field, changeKind, fills }) {
    const applicationFolder = this.findApplicationFolder(type.path);
    const found = this.findCallersOfField(type, field, applicationFolder);
    const everyFill = fills || this.fills.fillsOf(field, type.name, applicationFolder);
    return {
      kind: ENTRY_BOUNDARY_KINDS.GRAPHQL_FIELD,
      application: readApplicationName(type.path, this.roots),
      displayName: field.displayName,
      name: field.name,
      enclosingType: { displayName: type.displayName, name: type.name, path: type.path, line: type.line },
      path: type.path,
      line: field.line,
      to: field.to,
      changeKind,
      lines: readFieldLines(type.lines, field),
      sameNameOnOtherTypes: this.findOtherTypesNaming(field, type, applicationFolder),
      fills: everyFill,
      ...found,
      comparedFields: this.findComparedFields(field, applicationFolder, everyFill, found.callers),
    };
  }

  buildGraphQlFields(abstractions) {
    const inTheSchema = this.findFieldsChangedInTheSchema();
    const byFill = this.scheduleFieldsWithAChangedFill(abstractions, new Set(inTheSchema.map(({ field }) => field.displayName)));
    return [...inTheSchema, ...byFill].map(selectedField => this.buildGraphQlField(selectedField));
  }

  findHoldingType(abstraction) {
    const callGraph = this.findCallGraph(readLanguageFamily(abstraction.path));
    return findTypesEnclosingTheSpanInnermostFirst(callGraph ? callGraph.types : [], abstraction.path, { from: abstraction.lines.from, to: abstraction.lines.from })[0] || null;
  }

  findRouteMapping(abstraction) {
    const method = this.codeGraph.findDeclaredAt(abstraction.path, abstraction.lines.from, Scale.METHOD);
    const entryBoundaryRole = method ? method.roles.find(role => isAnEntryBoundaryRole(role) && role.facts.mapping) : null;
    return entryBoundaryRole ? entryBoundaryRole.facts.mapping : null;
  }

  findRestEndpoint(abstraction) {
    const lines = this.repositoryText.readFileLines(abstraction.path) || [];
    const type = this.findHoldingType(abstraction);
    const mapping = this.findRouteMapping(abstraction);
    if (!mapping) return null;
    const method = findInnermostMethodAt(this.findCallGraph(readLanguageFamily(abstraction.path)), abstraction.path, abstraction.lines.from);
    const to = Math.min(method ? method.to : abstraction.lines.to, mapping.from + MAX_SLICE_LINES - 1);
    const found = this.callers.findRestCallers(mapping.route, this.findApplicationFolder(abstraction.path));
    return {
      kind: ENTRY_BOUNDARY_KINDS.REST_ENDPOINT,
      application: readApplicationName(abstraction.path, this.roots),
      displayName: abstraction.displayName,
      name: abstraction.name,
      enclosingType: type ? { displayName: type.name, name: type.name, path: type.path, line: type.line } : { displayName: abstraction.enclosingTypeName || abstraction.displayName, name: abstraction.enclosingTypeName || abstraction.name, path: abstraction.path, line: abstraction.lines.from },
      path: abstraction.path,
      line: mapping.line,
      to: abstraction.lines.from,
      changeKind: abstraction.changeKind,
      verb: mapping.verb,
      route: mapping.route,
      lines: readNumberedLines(lines, mapping.line, abstraction.lines.from),
      sameNameOnOtherTypes: [],
      fills: [this.fills.addTheConditionCalls({ displayName: abstraction.displayName, path: abstraction.path, from: mapping.from, to, lines: readNumberedLines(lines, mapping.from, to) })],
      ...found,
    };
  }

  findRestEndpoints(abstractions) {
    return abstractions.filter(abstraction => isAChangedProductionMethod(abstraction) && this.findApplicationFolder(abstraction.path) !== null)
      .map(abstraction => this.findRestEndpoint(abstraction)).filter(Boolean);
  }

  findAbstractionIds(boundary, abstractions) {
    const spans = [{ path: boundary.path, from: boundary.line, to: boundary.to }, ...boundary.fills.map(fill => ({ path: fill.path, from: fill.from, to: fill.to }))];
    return [...new Set(abstractions.filter(abstraction => spans.some(span => holdsTheLines(abstraction, span.path, span.from, span.to))).map(abstraction => abstraction.id))];
  }
}
