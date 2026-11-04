const ITEM_HEAD = /^(\d+)\.(?: \[[^\]]*\])? (Application|Module|Class|Method|Variable|Abstraction) (?:`([^`]+)`(?: in `([^`]+)`)?)?/;

const SCALES_THE_PLAN_PLACES = new Set(["application", "module", "class"]);

const readNamedItemOfTheLine = line => {
  const match = ITEM_HEAD.exec(line);
  if (!match) return null;

  return { number: Number(match[1]), scale: match[2].toLowerCase(), name: match[3] || "", enclosing: match[4] || "" };
};

export const readNamedReviewItems = reportText => reportText.split("\n").map(readNamedItemOfTheLine).filter(Boolean);

export const readReviewItems = reportText => readNamedReviewItems(reportText).map(({ number, scale }) => ({ number, scale }));

export const isPlacedByThePlan = item => SCALES_THE_PLAN_PLACES.has(item.scale);
