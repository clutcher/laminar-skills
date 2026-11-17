import path from "node:path";
import { KINDS, isAText, isATestFileOfTheModel, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

// The 1 word that Spring's conventions of the skill code-style rule out (spring.md, section 5): a registry of Spring is a place that other code adds to.
const REGISTRY_LAST_WORD = /(?:^|[a-z0-9])Registry$/;

// The verbs that add to a registry of Spring.
const ADDING_VERB = /^(?:add|register|put)(?![a-z])/;

// The source holds only for Spring, which runs on the JVM, so only a Java or Kotlin file is read.
const JVM_EXTENSIONS = new Set([".java", ".kt"]);

// A conventions file named for Spring, as the designer lists the files of the project conventions.
const SPRING_CONVENTIONS_FILE = /spring/i;

// A marker or a package of Spring in a text of the model, such as a body written with @Bean or a type of org.springframework.
const SPRING_MARK = /@(?:Bean|Component|Service|Repository|Controller|RestController|Configuration|Autowired|SpringBootApplication)\b|\borg\.springframework\b/;

const PUBLIC_VISIBILITY = "public";

const KINDS_THAT_WRITE_THE_NAME = new Set([KINDS.CREATED, KINDS.MOVED]);

const readSimpleName = theClass => String(theClass.name || "").split(".").pop();

const listTheTextsOfTheClass = theClass => [
  ...readList(theClass.implements), ...readList(theClass.extends),
  ...readList(theClass.fields).map(field => field.type),
  ...readList(theClass.methods).flatMap(method => [method.body, method.returns, ...readList(method.parameters).map(parameter => parameter.type)]),
].filter(isAText);

// The design uses Spring where its project conventions list a file for Spring, or where a text of a class of the model holds a marker or a package of Spring.
const usesSpring = model => readList(model.decisions.conventions?.files).some(file => isAText(file) && SPRING_CONVENTIONS_FILE.test(path.posix.basename(file)))
  || model.classes.some(theClass => listTheTextsOfTheClass(theClass).some(text => SPRING_MARK.test(text)));

// The change writes the name of a class of a created or moved file, or of a class it renames.
const writesTheName = (model, theClass) => KINDS_THAT_WRITE_THE_NAME.has(model.getKindOfClass(theClass)) || isAText(theClass.oldName);

const isAJvmFile = file => JVM_EXTENSIONS.has(path.posix.extname(String(file || "")));

const offersAnAdd = theClass => readList(theClass.methods)
  .some(method => (!isAText(method.visibility) || method.visibility === PUBLIC_VISIBILITY) && ADDING_VERB.test(String(method.name || "")));

const createTheRegistryNameDefect = (model, theClass) => createRecheckDefect(
  DEFECT_CODES.REGISTRY_NAME_WITHOUT_ADD,
  model.getClassPath(theClass),
  `${theClass.name} ends in the word Registry and offers no public method that adds, registers or puts; a registry of Spring is a place that other code adds to (code-style spring.md section 5): name it for what it picks or answers, such as a Resolver or a Service, or answer under scriptCases with what adds to it`,
);

// In a design that uses Spring, a class of a Java or Kotlin file whose name the change writes, whose last name word is Registry and that offers no add, predicts an add that it does not have.
export const findRegistryNameDefects = model => {
  if (!usesSpring(model)) return [];
  return model.classes
    .filter(theClass => writesTheName(model, theClass) && isAJvmFile(theClass.file) && !isATestFileOfTheModel(model, theClass.file || ""))
    .filter(theClass => REGISTRY_LAST_WORD.test(readSimpleName(theClass)) && !offersAnAdd(theClass))
    .map(theClass => createTheRegistryNameDefect(model, theClass));
};
