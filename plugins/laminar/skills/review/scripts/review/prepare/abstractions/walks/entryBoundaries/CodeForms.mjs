import { findDeployableFolder, findDiffDriver, findDriver, isAnEntryBoundaryRole, readParameterNamesOfAList, readTypeNamesOfATypeText, readTypeTextOfParameter, Scale, splitAtTopLevelCommas } from "../../../../../code/index.mjs";
import { FileLines } from "../../lookups/FileLines.mjs";
import { TypeAbstractions } from "../parameters/TypeAbstractions.mjs";
import { readFieldTypeText, readNamedTypeOf } from "./EntryBoundariesWalk.mjs";
import { SchemaTypes } from "./SchemaTypes.mjs";

const FIELD_ARGUMENTS_PATTERN = /\(([^)]*)\)/;

const SCHEMA_ARGUMENT_PATTERN = /^\s*([A-Za-z_]\w*)\s*:\s*([^=@]+)/;

const readSchemaArguments = fieldText => splitAtTopLevelCommas((FIELD_ARGUMENTS_PATTERN.exec(String(fieldText)) || [])[1] || "")
  .map(argumentText => SCHEMA_ARGUMENT_PATTERN.exec(argumentText))
  .filter(Boolean)
  .map(([, name, typeText]) => ({ name, typeName: readNamedTypeOf(typeText) }));

const findTheSchemaMapping = method => (method.roles.find(role => isAnEntryBoundaryRole(role) && role.facts && role.facts.schemaMapping) || { facts: {} }).facts.schemaMapping || null;

const readTheOnlyTypeName = (typeText, filePath) => {
  const names = readTypeNamesOfATypeText(typeText, findDiffDriver(filePath));
  return names.length === 1 ? names[0] : "";
};

const readTheBoundName = (schemaArgument, filePath) => schemaArgument.name
  || readParameterNamesOfAList(`(${schemaArgument.parameterText})`, findDriver(filePath))[0] || "";

const namesAFieldOfTheType = (schemaMapping, type) => schemaMapping.names.some(name => type.fields.some(field => field.name === name));

const isMappedToTheField = (method, schemaMapping, type, field) => schemaMapping.names.includes(field.name)
  || (method.name === field.name && !namesAFieldOfTheType(schemaMapping, type));

const placeOfTheSchemaType = schemaType => ({ displayName: schemaType.displayName, file: schemaType.path, line: schemaType.line });

const buildTheTypeKey = type => `${type.place.file}:${type.place.startLine}`;

export class CodeForms {
  constructor(repositoryText, roots, codeGraph) {
    this.roots = roots;
    this.codeGraph = codeGraph;
    this.schemaTypes = new SchemaTypes(repositoryText, roots, codeGraph);
    this.typeAbstractions = new TypeAbstractions(codeGraph, new FileLines(repositoryText));
  }

  findTheCodeType(typeName, filePath) {
    if (!typeName) return null;
    const inScope = this.typeAbstractions.findTheTypesInScope(typeName, filePath);
    return inScope.length === 1 ? inScope[0] : null;
  }

  listResolvers() {
    return this.codeGraph.listAbstractionsAt(Scale.METHOD)
      .map(method => ({ method, schemaMapping: findTheSchemaMapping(method) }))
      .filter(({ method, schemaMapping }) => schemaMapping && method.place && findDriver(method.place.file));
  }

  findTheFieldsOfTheResolver(method, schemaMapping) {
    const applicationFolder = findDeployableFolder(method.place.file, this.roots);
    const schemaTypes = this.schemaTypes.listSchemaTypesOfTheApplication(applicationFolder);
    return schemaTypes.flatMap(type => type.fields
      .filter(field => isMappedToTheField(method, schemaMapping, type, field))
      .map(field => ({ type, field, fieldText: String(type.lines[field.line - 1] ?? ""), schemaTypes })));
  }

  bindTheArguments(method, schemaMapping, { fieldText, schemaTypes }) {
    const filePath = method.place.file;
    return readSchemaArguments(fieldText).flatMap(schemaArgument => {
      const schemaType = schemaTypes.find(type => type.name === schemaArgument.typeName && type.isInput);
      const parameter = (schemaMapping.arguments || []).find(argument => readTheBoundName(argument, filePath) === schemaArgument.name);
      const codeType = schemaType && parameter ? this.findTheCodeType(readTheOnlyTypeName(readTypeTextOfParameter(parameter.parameterText, findDiffDriver(filePath)), filePath), filePath) : null;
      return codeType ? [{ codeType, schemaType }] : [];
    });
  }

  bindTheReturnedType(method, { fieldText, schemaTypes }) {
    const schemaType = schemaTypes.find(type => type.name === readNamedTypeOf(readFieldTypeText(fieldText)) && !type.isInput);
    const returnType = ((method.signature || {}).returnType) || "";
    const codeType = schemaType && returnType ? this.findTheCodeType(readTheOnlyTypeName(returnType, method.place.file), method.place.file) : null;
    return codeType ? [{ codeType, schemaType }] : [];
  }

  listBindings() {
    return this.listResolvers().flatMap(({ method, schemaMapping }) => this.findTheFieldsOfTheResolver(method, schemaMapping)
      .flatMap(mappedField => [...this.bindTheArguments(method, schemaMapping, mappedField), ...this.bindTheReturnedType(method, mappedField)]));
  }

  findCodeForms() {
    const bindingsByCodeTypeMap = new Map();
    for (const binding of this.listBindings()) {
      const key = buildTheTypeKey(binding.codeType);
      if (!bindingsByCodeTypeMap.has(key)) bindingsByCodeTypeMap.set(key, { codeType: binding.codeType, schemaTypesByNameMap: new Map() });
      bindingsByCodeTypeMap.get(key).schemaTypesByNameMap.set(binding.schemaType.displayName, binding.schemaType);
    }
    return [...bindingsByCodeTypeMap.values()]
      .filter(({ schemaTypesByNameMap }) => schemaTypesByNameMap.size === 1)
      .map(({ codeType, schemaTypesByNameMap }) => ({
        file: codeType.place.file,
        line: codeType.place.startLine,
        to: codeType.place.endLine,
        name: codeType.name,
        declaredBySchema: placeOfTheSchemaType([...schemaTypesByNameMap.values()][0]),
      }))
      .sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0) || left.line - right.line);
  }
}
