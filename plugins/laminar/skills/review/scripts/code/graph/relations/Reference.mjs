import { Place } from "../abstractions/Place.mjs";
import { isACallKind, RELATION_KINDS } from "./Relation.mjs";

export const RECEIVER_KINDS = Object.freeze({
  NONE: "none",
  UNKNOWN: "unknown",
  OUTSIDE: "outside",
  INTERFACE: "interface",
  CLASS: "class",
  STATIC: "static",
  MODULE: "module",
  CHAIN: "chain",
});

export const CALL_FORMS = Object.freeze({
  DOTTED: "dotted",
  BARE: "bare",
  NEW: "new",
  SEND: "send",
  COMMAND: "command",
  METHOD_REFERENCE: "method reference",
});

export const REFERENCE_FORMS = Object.freeze({
  QUERY: "query",
  ROUTE: "route",
});

export const readCallFormOfAReceiver = hasAReceiver => (hasAReceiver ? CALL_FORMS.DOTTED : CALL_FORMS.BARE);

const constructsAType = reference => reference.form === CALL_FORMS.NEW;

export const readKindOfAResolvedReference = reference => (constructsAType(reference) ? RELATION_KINDS.USES_TYPE : reference.kind);

export const isAUseOfAType = reference => readKindOfAResolvedReference(reference) === RELATION_KINDS.USES_TYPE;

export const NO_RECEIVER = null;

export const UNNAMED_RECEIVER = "";

export const EXPRESSION_RECEIVER = ")";

export const namesAReceiver = receiver => Boolean(receiver) && receiver !== EXPRESSION_RECEIVER;

export const EXPRESSION_QUALIFIER = ")";

export const isAnExpressionQualifier = qualifier => qualifier === EXPRESSION_QUALIFIER;

export const namesAQualifier = qualifier => Boolean(qualifier) && !isAnExpressionQualifier(qualifier);

export const BARE_GROUP_MARK = "bare:";

export const formatBareGroupName = family => `${BARE_GROUP_MARK}${family}`;

export const isABareGroupName = name => String(name).startsWith(BARE_GROUP_MARK);

export const isAGroupOfTheFamily = name => isABareGroupName(name) || isAFunctionGroupName(name);

export const FUNCTION_GROUP_MARK = "function:";

export const formatFunctionGroupName = family => `${FUNCTION_GROUP_MARK}${family}`;

export const isAFunctionGroupName = name => String(name).startsWith(FUNCTION_GROUP_MARK);

export const CALL_STATUS = Object.freeze({
  RESOLVED: "resolved",
  IN_MEMORY: "in memory",
  OUTSIDE: "type outside the repository",
  UNKNOWN: "unknown type",
  NO_IMPLEMENTATION: "interface with no implementation in the repository",
  NOT_FOUND: "no declaration in the type",
  FAN_OUT: "more than 4 declarations",
  MANY_IMPLEMENTATIONS: "bare call on a method of the repository with more than 4 implementations",
  STATIC: "static call outside the repository",
  MODULE: "module outside the repository",
  CHAIN: "chained call",
  NONE: "no declaration",
  LOCAL_FUNCTION: "function the method declares",
  GENERATED: "generated member of a repository type",
});

export const chooseResolvedOrNotFoundStatus = targets => (targets.length ? CALL_STATUS.RESOLVED : CALL_STATUS.NOT_FOUND);

export const formatCallPlaceKey = (line, column) => `${line}:${column}`;

export const copyLoopFields = loop => ({ head: loop.head, form: loop.form });

const copyLoop = loop => (loop ? Object.freeze(copyLoopFields(loop)) : null);

const CALL_GRAPH_FACT_NAMES = Object.freeze({ argumentCount: "argumentCount", loop: "loop", once: "once", end: "end", outsideNames: "outsideNames" });

export const CALL_VIEW_FACT_NAMES = Object.freeze({ ...CALL_GRAPH_FACT_NAMES, argumentCount: "args", outsideNames: "on" });

export const createArgumentCountField = (reference, names = CALL_GRAPH_FACT_NAMES) => (reference.argumentCount === null ? {} : { [names.argumentCount]: reference.argumentCount });

export const collectCallGraphFacts = (reference, names = CALL_GRAPH_FACT_NAMES) => ({
  ...(reference.loop ? { [names.loop]: copyLoopFields(reference.loop) } : {}),
  ...(reference.once ? { [names.once]: true } : {}),
  ...(reference.end ? { [names.end]: true } : {}),
  ...(reference.outsideNames ? { [names.outsideNames]: [...reference.outsideNames] } : {}),
});

export class Reference {
  constructor({ id, kind, from, name, receiver = "", callReceiver = receiver, argumentCount = null, place = null, foundBy = "", resolution = "", column = null, form = "", loop = null, once = false, end = false, outsideNames = null }) {
    this.id = id;
    this.kind = kind;
    this.from = from;
    this.name = name;
    this.receiver = receiver;
    this.callReceiver = callReceiver ?? receiver;
    this.argumentCount = argumentCount;
    this.place = place;
    this.foundBy = foundBy;
    this.resolution = resolution;
    this.column = column;
    this.form = form;
    this.loop = copyLoop(loop);
    this.once = once;
    this.end = end;
    this.outsideNames = outsideNames ? Object.freeze([...outsideNames]) : null;
    Object.freeze(this);
  }

  isAReadCall() {
    return isACallKind(this) && Boolean(this.resolution);
  }

  readAsCall(from, call) {
    return new Reference({ ...this, from, ...call });
  }

  isAMethodReference() {
    return this.form === CALL_FORMS.METHOD_REFERENCE;
  }

  isADirectCall() {
    return isACallKind(this) && !this.isAMethodReference();
  }

  isACalledMethodReference() {
    return isACallKind(this) && this.isAMethodReference();
  }

  toJSON() {
    return {
      id: this.id,
      kind: this.kind,
      from: this.from.id,
      name: this.name,
      ...(this.receiver ? { receiver: this.receiver } : {}),
      ...createArgumentCountField(this),
      ...(this.place ? { place: this.place.toJSON() } : {}),
      ...(this.foundBy ? { foundBy: this.foundBy } : {}),
      ...(this.resolution ? { resolution: this.resolution } : {}),
      ...(this.column === null ? {} : { column: this.column }),
      ...(this.form ? { form: this.form } : {}),
      ...collectCallGraphFacts(this),
    };
  }

  static createFromJSON(saved, abstractionAt) {
    return new Reference({ ...saved, from: abstractionAt(saved.from), place: saved.place ? Place.createFromJSON(saved.place) : null });
  }
}
