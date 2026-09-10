import { CALL_FORMS, CALL_STATUS, findCallsOnLine, createCodeLines, findDiffDriver, findInnermostMethodAt, isACallAfter, isAnAssignmentAfter, readLanguageFamily, namesAType, NO_RECEIVER, findReceiverBefore, UNNAMED_RECEIVER, buildWholeWordPattern, WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../code/index.mjs";

export const NO_ENCLOSING_METHOD = null;

const STATUSES_OF_ANOTHER_RECEIVER = new Set([CALL_STATUS.STATIC, CALL_STATUS.MODULE, CALL_STATUS.LOCAL_FUNCTION]);

const createWordPattern = word => buildWholeWordPattern(word, "g");

const findValueUses = (code, name) => [...code.matchAll(createWordPattern(name))]
  .map(found => ({ at: found.index, after: code.slice(found.index + name.length) }))
  .filter(use => !isACallAfter(use.after) && !isAnAssignmentAfter(use.after));

export class MethodCallers {
  constructor(repositoryText, testCode, callGraph, references) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.callGraph = callGraph;
    this.references = references;
    this.resultsByMethodMap = new Map();
    this.codeByPathMap = new Map();
    this.repositoryTypes = new Set(callGraph.methods.map(method => method.enclosingTypeName).filter(Boolean));
  }

  readCode(filePath) {
    if (!this.codeByPathMap.has(filePath)) this.codeByPathMap.set(filePath, createCodeLines(this.repositoryText.readFileLines(filePath) || [], filePath));
    return this.codeByPathMap.get(filePath);
  }

  namesTheEnclosingType(filePath, enclosingTypeName) {
    return this.references.lines.collectNamesInFile(filePath).has(enclosingTypeName);
  }

  findEnclosingMethod(place) {
    return findInnermostMethodAt(this.callGraph, place.path, place.line);
  }

  isADeclarationHead(place, method) {
    return this.callGraph.findMethodsDeclaredAt(place.path, place.line).some(declaredMethod => declaredMethod.name === method.name);
  }

  declaresTheName(enclosingTypeName, name) {
    return this.callGraph.methods.some(method => method.enclosingTypeName === enclosingTypeName && method.name === name);
  }

  doesBareUseReach({ place, caller, method }) {
    if (!method.enclosingTypeName || place.path === method.path) return true;
    if (caller && caller.enclosingTypeName === method.enclosingTypeName) return true;
    return this.namesTheEnclosingType(place.path, method.enclosingTypeName);
  }

  doesReceiverReach(receiver, context) {
    const { method } = context;
    if (WORDS_FOR_THE_ENCLOSING_TYPE.has(receiver)) return this.doesBareUseReach(context);
    if (receiver === method.enclosingTypeName) return true;
    if (this.declaresTheName(receiver, method.name)) return false;
    return !namesAType(receiver) || this.repositoryTypes.has(receiver);
  }

  doesFormReach(call, context) {
    if (call.form === CALL_FORMS.BARE) return this.doesBareUseReach(context);
    if (call.form === CALL_FORMS.DOTTED && call.receiver) return this.doesReceiverReach(call.receiver, context);
    return true;
  }

  doesResolvedCallReach(call, context) {
    if (call.targets.length) return call.targets.includes(context.method.id);
    if (STATUSES_OF_ANOTHER_RECEIVER.has(call.status)) return false;
    return this.doesFormReach(call, context);
  }

  doesValueUseReach(receiver, context) {
    if (receiver === NO_RECEIVER) return this.doesBareUseReach(context);
    if (receiver === UNNAMED_RECEIVER) return true;
    return this.doesReceiverReach(receiver, context);
  }

  doCallsReach(code, chainHead, context) {
    const { place, caller, method } = context;
    const resolved = caller ? caller.calls.filter(call => call.line === place.line && call.callee === method.name) : [];
    if (resolved.length) return resolved.some(call => this.doesResolvedCallReach(call, context));
    return findCallsOnLine(code, findDiffDriver(place.path) || "", 0, chainHead)
      .filter(call => call.callee === method.name)
      .some(call => this.doesFormReach(call, context));
  }

  reaches(place, method) {
    const read = this.readCode(place.path);
    const code = read.code[place.line - 1] || "";
    const context = { place, method, caller: this.findEnclosingMethod(place) };
    if (this.doCallsReach(code, read.chainHeads[place.line - 1] || "", context)) return true;
    const diffDriver = findDiffDriver(place.path) || "";
    return findValueUses(code, method.name).some(use => this.doesValueUseReach(findReceiverBefore(code, use.at, diffDriver), context));
  }

  findCallerAtPlace(place, method) {
    if (this.testCode.isTestPlace(place) || this.isADeclarationHead(place, method)) return null;
    if (!this.reaches(place, method)) return null;
    const caller = this.findEnclosingMethod(place);
    return { id: caller ? caller.id : NO_ENCLOSING_METHOD, path: place.path, line: place.line };
  }

  findCallers(method) {
    if (!this.resultsByMethodMap.has(method.id)) {
      const places = this.references.findNamingPlaces(method.name, readLanguageFamily(method.path));
      this.resultsByMethodMap.set(method.id, { callers: places.map(place => this.findCallerAtPlace(place, method)).filter(Boolean), stopped: false });
    }
    return this.resultsByMethodMap.get(method.id);
  }
}
