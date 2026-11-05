const ITEM_HEAD = /^(\d+)\.(?: \[[^\]]*\])? (Application|Module|Class|Method|Variable|Abstraction)(?: (.*))?$/;

const QUOTE = "`";

const ENCLOSING_SEPARATOR = "` in `";

const USED_BARE_SEPARATOR = "` used bare in `";

const SCALES_THE_PLAN_PLACES = new Set(["application", "module", "class"]);

const createHeadNames = (name, enclosing = "") => ({ name, enclosing });

// A name in backticks may hold backticks itself, as a Kotlin test name does, so the head ends at the last backtick of the line, and the enclosing name follows the last separator.
const readNamesOfTheHead = headText => {
  const lastQuoteAt = headText.lastIndexOf(QUOTE);
  if (!headText.startsWith(QUOTE) || lastQuoteAt === 0) return createHeadNames("");

  const quoted = headText.slice(QUOTE.length, lastQuoteAt);
  const usedBareAt = quoted.indexOf(USED_BARE_SEPARATOR);
  if (usedBareAt >= 0) return createHeadNames(quoted.slice(0, usedBareAt));
  const enclosingAt = quoted.lastIndexOf(ENCLOSING_SEPARATOR);
  if (enclosingAt < 0) return createHeadNames(quoted);
  return createHeadNames(quoted.slice(0, enclosingAt), quoted.slice(enclosingAt + ENCLOSING_SEPARATOR.length));
};

const readNamedItemOfTheLine = line => {
  const match = ITEM_HEAD.exec(line);
  if (!match) return null;

  return { number: Number(match[1]), scale: match[2].toLowerCase(), ...readNamesOfTheHead(match[3] || "") };
};

export const readNamedReviewItems = reportText => reportText.split("\n").map(readNamedItemOfTheLine).filter(Boolean);

export const readReviewItems = reportText => readNamedReviewItems(reportText).map(({ number, scale }) => ({ number, scale }));

export const isPlacedByThePlan = item => SCALES_THE_PLAN_PLACES.has(item.scale);
