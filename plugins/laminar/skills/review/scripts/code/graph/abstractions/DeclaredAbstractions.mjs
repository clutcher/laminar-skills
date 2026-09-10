import { shortenText } from "../../inputs/source/text/ShortenedText.mjs";

const NO_DECLARED_ABSTRACTIONS = Object.freeze([]);

const declaredAbstractionsByGraphMap = new WeakMap();

const copyDeclaredAbstraction = (abstraction, linesOf) => {
  const { file, startLine } = abstraction.place;
  const text = (linesOf(file) || [])[startLine - 1];
  return { path: file, line: startLine, name: abstraction.name, scale: abstraction.scale.name, text: shortenText(String(text ?? "").trim()), holdsNoValue: abstraction.measures.holdsAValue === false };
};

const readDeclaredAbstractionsOf = (graph, linesOf) => graph.listAbstractionsDeclaredAfterTheChangeInPlaceOrder().map(abstraction => copyDeclaredAbstraction(abstraction, linesOf));

const rememberDeclaredAbstractions = (graph, readTheDeclaredAbstractions) => {
  if (!declaredAbstractionsByGraphMap.has(graph)) declaredAbstractionsByGraphMap.set(graph, readTheDeclaredAbstractions());
  return declaredAbstractionsByGraphMap.get(graph);
};

export function readDeclaredAbstractions(graph, linesOf) {
  if (!graph) return NO_DECLARED_ABSTRACTIONS;
  return rememberDeclaredAbstractions(graph, () => readDeclaredAbstractionsOf(graph, linesOf));
}
