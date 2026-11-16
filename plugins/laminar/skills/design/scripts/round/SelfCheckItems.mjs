const describeItemFinding = (number, finding) => ({ number, check: finding.check, displayName: finding.displayName });

const describeDecidedFinding = finding => ({ check: finding.check, displayName: finding.displayName, reason: finding.reason });

// The kept findings and the items to consider of 1 self-check, each with the item number of its review.md, and the results the design decided, which ask the writer nothing.
export function listSelfCheckItems(run) {
  const kept = [];
  const toConsider = [];
  for (const item of run.items) {
    for (const finding of item.findings) (finding.toConsider ? toConsider : kept).push(describeItemFinding(item.number, finding));
  }
  return { kept, toConsider, decided: (run.decidedFindings || []).map(describeDecidedFinding) };
}
