const SEPARATOR = " · ";

const NOT_GIVEN = "not given";

const FIRST_ROUND = "first round";

const formatDollars = dollars => (dollars === null ? NOT_GIVEN : dollars.toFixed(2));

const writeCountsLine = counts => `counts: ${[
  `findings ${counts.findings}`,
  `open ${counts.open}`,
  `with a reason ${counts.withAReason}`,
  `closed by an answer ${counts.closedByAnAnswer}`,
  `carried ${counts.carried}`,
  `to the designer ${counts.toTheDesigner}`,
  `to the writers ${counts.toTheWriters}`,
  `still open, not judged ${counts.stillOpen}`,
].join(SEPARATOR)}`;

const writeComparisonLine = (round, comparison) => {
  if (!comparison) return `compared: ${FIRST_ROUND}`;
  return `compared with round ${round - 1}: ${[
    `judged in both ${comparison.judgedInBoth}`,
    `vanished ${comparison.vanished} (closed by a fix ${comparison.closedByAFix}, no fix step ${comparison.noFixStep})`,
    `not judged again ${comparison.notJudgedAgain} (still open ${comparison.stillOpen}, closed by the model ${comparison.closedByTheModel})`,
    `appeared ${comparison.appeared} (on keys judged in round ${round - 1}: ${comparison.appearedOnJudgedKeys}, carried: ${comparison.appearedCarried})`,
  ].join(SEPARATOR)}`;
};

const writeFixCreatedLine = (fixCreated, comparison) => {
  if (!fixCreated.checked) return `fix-created files: ${fixCreated.why}`;
  const appeared = comparison ? comparison.appeared : 0;
  const onThem = comparison ? comparison.appearedOnFixCreatedFiles : 0;
  const share = appeared ? Math.round((100 * onThem) / appeared) : 0;
  return `fix-created files: ${fixCreated.files.length}${SEPARATOR}appeared findings on them ${onThem} of ${appeared} (${share} percent)`;
};

const writeOpenOnBothLine = comparison => `open on keys judged in both rounds: ${comparison ? `${comparison.openBefore} then ${comparison.openNow}` : FIRST_ROUND}`;

const writeTabLine = words => words.join("\t");

export const writeRoundLines = result => [
  `round: ${result.round}${SEPARATOR}run: ${result.run}${SEPARATOR}scales: ${result.scales.join(", ")}${SEPARATOR}judged keys: ${result.judgedKeyCount}`,
  writeCountsLine(result.counts),
  writeComparisonLine(result.round, result.comparison),
  writeFixCreatedLine(result.fixCreated, result.comparison),
  writeOpenOnBothLine(result.comparison),
  `dollars: this round ${formatDollars(result.dollars.round)}${SEPARATOR}so far ${formatDollars(result.dollars.soFar)}`,
  ...result.notJudgedLines.map(line => writeTabLine(["not judged", line.mark, line.displayName, line.check, line.text])),
  ...result.defects.map(defect => writeTabLine(["defect", defect.code, defect.displayName, defect.text])),
  ...result.sendLines.map(sendLine => writeTabLine(["send", sendLine.to, sendLine.displayName, sendLine.text])),
  writeTabLine(["loop", result.loopLine.word, result.loopLine.code, result.loopLine.text]),
];
