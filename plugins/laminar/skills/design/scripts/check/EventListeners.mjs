import { KINDS, isAText, isATestFileOfTheModel, readList, readTypeNames } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { isAConstructor, listReasonWords } from "./SimplestForm.mjs";

// An event type is named for what happened and ends in Event in Java, Kotlin, TypeScript and Python.
const EVENT_LAST_WORD = /(?:^|[a-z0-9])Event$/;

// The verbs that create, publish or hand on an event in every event bus and store, such as publishEvent of Spring, post of Guava, emit of Node and the append of an outbox, so a method named by one hands the event on and does not hear it.
const HANDING_ON_VERB = /^(?:publish|send|emit|raise|fire|dispatch|post|create|build|make|notify|broadcast|enqueue|schedule|submit|append|store|save)(?![a-z])/;

// A method that returns nothing in Java, Kotlin, TypeScript and Python; a method that returns a value maps the event into another form and does not hear it.
const NO_VALUE = /^(?:void|Unit|None|undefined|never|Nothing)?$/;

const DOMAIN_OBJECT = "domain object";

const EVENTS_SENTENCE = "\"So events earn their place only when their benefit outweighs that cost: many classes react, and each belongs to a different part of the system.\" (The Principles at Every Scale, Open-Closed Principle)";

const readSimpleName = theClass => String(theClass.name || "").split(".").pop();

// A class marked domain object is a thing of the business, such as a concert in a ticket shop, and no message, whatever its name.
const isReadForTheListeners = (model, theClass) => model.getKindOfClass(theClass) === KINDS.CREATED
  && theClass.represents !== DOMAIN_OBJECT
  && EVENT_LAST_WORD.test(readSimpleName(theClass))
  && !isATestFileOfTheModel(model, theClass.file || "");

const takesTheEvent = (model, otherClass, method, eventClass) => readList(method.parameters)
  .some(parameter => readTypeNames(parameter.type).some(typeName => model.findClassOfTheType(typeName, otherClass) === eventClass));

const hearsTheEvent = (model, otherClass, method, eventClass) => !isAConstructor(otherClass, method)
  && NO_VALUE.test(String(method.returns || "").trim())
  && !HANDING_ON_VERB.test(String(method.name || ""))
  && takesTheEvent(model, otherClass, method, eventClass);

const isAnotherClassOfTheChange = (model, otherClass, eventClass) => otherClass !== eventClass
  && model.findOutermostClass(otherClass) !== eventClass
  && !isATestFileOfTheModel(model, otherClass.file || "");

// Each method of another class that takes the event, with its class, except a method that creates or publishes it.
const listTheListeningMethods = (model, eventClass) => model.classes
  .filter(otherClass => isAnotherClassOfTheChange(model, otherClass, eventClass))
  .flatMap(otherClass => readList(otherClass.methods)
    .filter(method => hearsTheEvent(model, otherClass, method, eventClass))
    .map(method => ({ theClass: otherClass, method })));

const escapeForAPattern = text => text.replace(/[$.*+?^()[\]{}|\\]/g, "\\$&");

const createsTheEvent = (method, eventName) => new RegExp(`(?<![\\w$.])(?:new\\s+)?${escapeForAPattern(eventName)}\\s*\\(`).test(String(method.body || ""))
  || readList(method.calls).some(call => call === eventName || call.split("#")[0] === eventName);

const listThePublishers = (model, eventClass, listenerClass) => model.classes
  .filter(otherClass => isAnotherClassOfTheChange(model, otherClass, eventClass) && otherClass !== listenerClass)
  .filter(otherClass => readList(otherClass.methods).some(method => createsTheEvent(method, readSimpleName(eventClass))))
  .map(otherClass => model.getClassDisplayName(otherClass));

const createTheEventDefect = (model, eventClass, listeningMethods) => {
  const listenerClass = listeningMethods[0].theClass;
  const listenerNames = listeningMethods.map(({ theClass, method }) => model.getMethodDisplayName(theClass, method)).join(", ");
  const publishers = listThePublishers(model, eventClass, listenerClass);
  const publisherText = publishers.length ? publishers.join(", ") : `the class that publishes ${eventClass.name}`;
  return {
    ...createRecheckDefect(
      DEFECT_CODES.EVENT_WITH_ONE_LISTENER,
      model.getClassPath(eventClass),
      `${eventClass.name} is a created event that only ${model.getClassDisplayName(listenerClass)} hears, in ${listenerNames}; the book: ${EVENTS_SENTENCE}; shape 1, the event: ${publisherText} publishes ${eventClass.name} and ${listenerNames} hears it; shape 2, the direct call: ${publisherText} calls ${listenerNames} through the way out it already has; take shape 2, or keep shape 1 with a question of the model whose 2 options are these 2 shapes and answer under scriptCases with the id of that question; recommend shape 1 only where the input states a reason for the event, such as a second listener it names or a consumer on the roadmap`,
    ),
    answerTest: namesAQuestionOfTheEvent,
  };
};

// A created event that exactly 1 other class hears hides 1 call behind a bus, where the book asks for many classes in different parts of the system.
export const findEventListenerDefects = model => {
  const defects = [];
  for (const eventClass of model.classes.filter(theClass => isReadForTheListeners(model, theClass))) {
    const listeningMethods = listTheListeningMethods(model, eventClass);
    if (new Set(listeningMethods.map(({ theClass }) => theClass)).size === 1) defects.push(createTheEventDefect(model, eventClass, listeningMethods));
  }
  return defects;
};

// A question names the event where its fact, the name or the shape of 1 of its options holds the name of the event as a word.
const namesTheEvent = (question, eventClass) => [question.fact, ...readList(question.options).flatMap(option => [option?.name, option?.shape])]
  .some(text => listReasonWords(text).includes(readSimpleName(eventClass)));

// An answer under scriptCases closes the case only where it names the id of a question of the model that names the event, the question that holds the 2 shapes and its recommendation.
export const namesAQuestionOfTheEvent = (model, eventClass, reason) => {
  const words = listReasonWords(reason);
  return readList(model.decisions.questions).some(question => isAText(question.id) && words.includes(question.id) && namesTheEvent(question, eventClass));
};
