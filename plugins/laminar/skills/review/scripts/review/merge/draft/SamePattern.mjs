import { CHECKS_BY_ID_MAP, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { buildPlaceKey, collectQuotedPlaceKeys, stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";
import { isInTheChange, buildPlaceAndFirstOwnLineKey } from "../returns/PossibleFindings.mjs";

const FEWEST_SHARED_PLACES_OF_ONE_DECISION = 2;

const LEAST_SHARE_OF_QUOTED_LINES_OF_ONE_DECISION = 0.9;

const LEAST_SHARE_OF_QUOTED_TEXT_OF_ONE_TEST_SHAPE = 0.5;

const collapseText = text => String(text || "").trim().replace(/\s+/g, " ");

const collectPlaceKeys = finding => new Set([
  buildPlaceKey(finding),
  ...(finding.alsoAt || []).filter(place => place.displayName).map(buildPlaceKey),
]);

const collectQuotedLines = finding => collectQuotedPlaceKeys([finding]);

const collapseQuotedTexts = finding => new Set((finding.quotes || []).map(quote => collapseText(quote.text)).filter(Boolean));

const countShared = (one, other) => [...one].filter(key => other.has(key)).length;

const measureTheSharedShare = (one, other) => {
  const distinctElementCount = new Set([...one, ...other]).size;
  return distinctElementCount ? countShared(one, other) / distinctElementCount : 0;
};

const buildEnclosingKey = finding => `${stripLeadingDotSlash(finding.file)}::${(finding.abstraction || {}).enclosing || ""}`;

const areNamingTheSameCopies = (one, other) => countShared(collectPlaceKeys(one), collectPlaceKeys(other)) >= FEWEST_SHARED_PLACES_OF_ONE_DECISION
  && countShared(collectQuotedLines(one), collectQuotedLines(other)) > 0;

const areQuotingTheSameCopies = (one, other) => measureTheSharedShare(collectQuotedLines(one), collectQuotedLines(other)) >= LEAST_SHARE_OF_QUOTED_LINES_OF_ONE_DECISION;

const areCopiesOfOneDecision = (one, other) => one.check === CHECKS_BY_ID_MAP.S1.id
  && (areNamingTheSameCopies(one, other) || areQuotingTheSameCopies(one, other));

const isATestMethodFinding = finding => finding.track === TRACKS.TEST_METHOD;

const areCopiesOfOneTestShape = (one, other) => isATestMethodFinding(one) && isATestMethodFinding(other)
  && buildEnclosingKey(one) === buildEnclosingKey(other)
  && measureTheSharedShare(collapseQuotedTexts(one), collapseQuotedTexts(other)) >= LEAST_SHARE_OF_QUOTED_TEXT_OF_ONE_TEST_SHAPE;

const isALostSchemaOfATest = finding => finding.check === CHECKS_BY_ID_MAP.S4.id && isATestMethodFinding(finding);

const areLostSchemasOfOneTestClass = (one, other) => isALostSchemaOfATest(one) && isALostSchemaOfATest(other)
  && buildEnclosingKey(one) === buildEnclosingKey(other);

const areAtTwoPlaces = (one, other) => buildPlaceAndFirstOwnLineKey(one) !== buildPlaceAndFirstOwnLineKey(other);

const areCopiesOfOnePattern = (one, other) => one !== other
  && one.check === other.check
  && areAtTwoPlaces(one, other)
  && isInTheChange(one) === isInTheChange(other)
  && (areCopiesOfOneDecision(one, other) || areCopiesOfOneTestShape(one, other) || areLostSchemasOfOneTestClass(one, other));

export const repeatTheSamePattern = (one, other) => one.some(possibleFinding => other.some(copy => areCopiesOfOnePattern(possibleFinding, copy)));

export const holdsCopiesOfOnePattern = result => result.some((possibleFinding, order) => result.slice(order + 1).some(copy => areCopiesOfOnePattern(possibleFinding, copy)));
