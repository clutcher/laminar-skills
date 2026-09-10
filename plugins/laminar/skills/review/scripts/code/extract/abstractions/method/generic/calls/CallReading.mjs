import { METHOD_FINDER_REGISTRY } from "../../index.mjs";
import { FinderContext } from "../../../../finders/FinderContext.mjs";

export { readArgumentCount, createBareCall, readArgumentCountAndFirst, readsAPath } from "./CallScanner.mjs";

const readRelationFinder = diffDriver => METHOD_FINDER_REGISTRY.findRelationFinder(FinderContext.createForLanguage(diffDriver));

const shiftOntoTheLine = (at, head, shift) => (at >= head.length ? at - shift : -1);

const removeTheHead = (call, head, shift) => ({
  ...call,
  col: call.col - shift,
  opening: shiftOntoTheLine(call.opening, head, shift),
  closing: shiftOntoTheLine(call.closing, head, shift),
  ...(call.receiverAt === undefined ? {} : { receiverAt: shiftOntoTheLine(call.receiverAt, head, shift) }),
  ...(call.qualifierAt === undefined ? {} : { qualifierAt: shiftOntoTheLine(call.qualifierAt, head, shift) }),
});

function findCallsJoinedToTheHead(text, diffDriver, from, head) {
  const indent = text.length - text.trimStart().length;
  const shift = head.length - indent;
  return findCallsOnLine(head + text.trimStart(), diffDriver, head.length + Math.max(0, from - indent)).map(call => removeTheHead(call, head, shift));
}

export function findCallsOnLine(code, diffDriver, from = 0, chainHead = "") {
  const text = String(code || "");
  if (!text.trim()) return [];
  if (chainHead) return findCallsJoinedToTheHead(text, diffDriver, from, chainHead);
  return readRelationFinder(diffDriver).findCallsOnLine(text, from);
}

export const findReceiverBefore = (code, at, diffDriver) => readRelationFinder(diffDriver).findReceiverBefore(code, at);

export const findChainRootBefore = (code, at, diffDriver) => readRelationFinder(diffDriver).findChainRootBefore(code, at);
