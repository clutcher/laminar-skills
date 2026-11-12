const describeItemFinding = (number, finding) => ({ number, check: finding.check, displayName: finding.displayName });

// The kept findings and the items to consider of 1 self-check, each with the item number of its review.md.
export function listSelfCheckItems(run) {
  const kept = [];
  const toConsider = [];
  for (const item of run.items) {
    for (const finding of item.findings) (finding.toConsider ? toConsider : kept).push(describeItemFinding(item.number, finding));
  }
  return { kept, toConsider };
}
