const ITEM_HEAD = /^(\d+)\.(?: \[[^\]]*\])? (Application|Module|Class|Method|Variable|Abstraction)(?: (.*))?$/;

const QUOTE = "`";

const ENCLOSING_SEPARATOR = "` in `";

const USED_BARE_SEPARATOR = "` used bare in `";

const SCALES_THE_PLAN_PLACES = new Set(["application", "module", "class"]);

// The review prints its items to consider under this heading, after the items of every track.
const TO_CONSIDER_HEADING = "## To consider";

const SECTION_HEADING = /^## /;

const ITEM_BULLET = /^\s+- (.+)$/;

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

const readNamedItemOfTheLine = (line, isToConsider) => {
  const match = ITEM_HEAD.exec(line);
  if (!match) return null;

  return { number: Number(match[1]), scale: match[2].toLowerCase(), toConsider: isToConsider, ...readNamesOfTheHead(match[3] || "") };
};

// Each item knows whether it stands under the heading of the items to consider, which ask the author a question and claim no defect, and holds its first bullet line as its summary.
export const readNamedReviewItems = reportText => {
  let isToConsider = false;
  const items = [];
  for (const line of reportText.split("\n")) {
    if (SECTION_HEADING.test(line)) isToConsider = line.trim() === TO_CONSIDER_HEADING;
    const item = readNamedItemOfTheLine(line, isToConsider);
    if (item) {
      items.push(item);
      continue;
    }
    const bullet = ITEM_BULLET.exec(line);
    const lastItem = items.at(-1);
    if (bullet && lastItem && lastItem.summary === undefined) lastItem.summary = bullet[1];
  }
  return items;
};

export const readReviewItems = reportText => readNamedReviewItems(reportText).map(({ number, scale }) => ({ number, scale }));

export const isPlacedByThePlan = item => SCALES_THE_PLAN_PLACES.has(item.scale);
