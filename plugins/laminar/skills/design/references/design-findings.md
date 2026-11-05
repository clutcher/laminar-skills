# The keys that the review, the checks and the writer fill

Contents: `findings` · `stops` · `existingDefects` · `scriptCases` · Which script reads which key

This file holds 4 keys of `decisions`, the decisions half of the design model: `findings`, `stops`, `existingDefects` and `scriptCases`. The designer writes each of them from what comes back: the items of a run of the review, of a shape run, the existing defects of a modified class, the recheck cases of the design check and the stops of the writer. `design-decisions.md` and `design-boundaries.md` hold the other keys of `decisions`. Every key that names an abstraction holds a display name (`design-model.md`, section 5).

## `findings`

1 object per numbered item of `review.md` of the input run folder at the application, module and class scales, and 1 object per kept item of each shape run; an empty list where the input is no run folder and no shape run kept an item. Each object holds exactly 1 of `closedBy`, `reason` and `openAfterCeiling`. A kept item to consider, which asks the author a question and claims no defect, also takes an object: `closedBy` where the tree answers its question, else the reason class `question to the author`, because autonomous mode passes the question on as a consideration of the plan, never in silence. A finding at the method or variable scale takes no object: the finish command writes it into `findings.json`, and the migration gives it 1 finding step or 1 line under `## Findings with no step` (`design-checks.md`, section 5).

| Key | Type | Required | Read by |
|---|---|---|---|
| `run` | number: the number of the shape run, as in `shape-runs/<n>` | on the object of an item of a shape run; left out on the object of an item of the input run folder | design check, render |
| `number` | number: the number of the item in `review.md` of that run | yes | design check, render |
| `check` | text: the check id, only where 1 item holds 2 checks that are decided apart; the item then takes 1 object per check | no | design check, render |
| `closedBy` | for an item of the input run folder, the display name of the part or the owner of the decision in the model that closes the item; for an item of a shape run, text: the change of the tree in the next shape run, which names the class, method or folder it changes | where the model closes the item | design check, which resolves the display name of an item of the input run folder; render |
| `reason` | 1 reason class: `outside the change`, `question to the author`, `project convention`, `exempt by the book` or `fix apart` | where the item is left on purpose | design check, which reports a class outside the list (`finding-reason-outside-list`); render |
| `says` | text: why the reason class holds | with `reason` | design check, render |
| `decidedBy` | text: who decided the reason class, as the decided list of the input gives it, such as `user` or `autonomous`, else `caller`; only on the object of an item that the decided list decides, with its `reason` and its `says` unchanged | with a reason of the decided list | design check with `--decided`, which reports a missing or changed object (`decided-not-carried`); render, which prints `left, <reason>, decided by <decidedBy>: <says>` |
| `openAfterCeiling` | text: the change of the tree that the item needs, which no shape check judged | only on the object of an item of a shape run, where the ceiling of shape runs is reached and the designer runs no shape check after the ceiling (`SKILL.md`, section 4, step 5) | design check, render, which prints the object in the section `## Open after the ceiling` |

The shape check loops until every kept item of the last shape run is closed by the tree or holds a reason class here (`SKILL.md`, section 4, step 5). For an item of a shape run, `outside the change` holds only where the member that the item names stands in a `modified` or `unchanged` file, with no `body` and no `oldName`, and with the same signature as in the current tree; on a method marked `unchanged: true` it holds with no further test, because the design check verifies the mark itself (`design-model.md`, section 3). It also holds for an item on a folder, and for an item on a member with a `body`, where every cause line that the item cites already stands in the base commit, so the cause is older than the change; the design check reads those lines in the tree of the base commit. A defect of an existing field or member of a class of a `modified` file never takes a reason class: it is inside the change, and the designer fixes it (`existingDefects`).

In the reason class `question to the author`, the author is the user, who answers the questions of the design. In the mode with a user, a finding that the user keeps as it is takes `question to the author`, and its `says` holds the answer keep with the reason of the user. In autonomous mode, no finding is kept on purpose by the designer: a finding that the model does not close and that neither `outside the change`, `project convention` nor the decided list leaves stays open, and an item to consider that the tree does not answer takes `question to the author`, which the finish command lists under `considerations` of `outcome.json` and under *To consider* of `design.md`, while the plan stays `ready`. The finish command with `--autonomous` reports every other reason that holds no `decidedBy` as the defect `reason-not-autonomous`. A reason of the decided list stands in every mode, because the calling session decided it.

The design check reads `review.md` of the input run folder where `--review <path of review.md>` is given, and reports an item at those 3 scales with no object (`finding-without-object`) and an object with no `run` whose `number` no such item holds (`finding-number-unknown`). It reads `review.md` of each shape run given as `--shape-review <results>/shape-runs/<n>/review.md`, once per shape run, takes `<n>` as the `run`, and reports the same 2 codes for the items of that shape run and the objects of that `run`. With `--repo`, it reads the current tree for each object of a shape run whose `reason` is `outside the change`, and reports it as a defect where the member the item names fails the rule above, or where the item names no class or method of the model (`outside-the-change-but-changed`). For every object, it reports 2 or more of `closedBy`, `reason` and `openAfterCeiling` (`finding-closed-and-left`), none of them (`finding-neither-closed-nor-left`), and a `closedBy` that names no part that the design creates, moves, renames or modifies (`closed-by-unchanged-part`), because a part that stays as it is closes no finding. A `closedBy` names a change of the tree that a shape check judged; a change that no shape check judged is `openAfterCeiling`, and the writers write the tree as the last shape check judged it.

```json
"findings": [ { "number": 3, "closedBy": "InvoicePricing#priceLines" }, { "run": 2, "number": 4, "reason": "outside the change", "says": "entry message untouched" } ]
```

## `stops`

1 object per stop of the writer, which the start command records from the input `stop: <file>`. Empty before a writer stopped. The keys: `reason`, a stop reason of the lists below; `at`, a display name, which the design check resolves; `says`, what the writer met; `plan`, the number of the plan whose migration the writer wrote, which a model of 0.72.0 holds as `round`; and `group`, the migration group of the stop, which the start command adds. The first 4 are required, and the render prints each. A reason outside the lists below stops the design check with exit 2.

The stop reasons that the writer gives:

- `input-nothing-provides`
- `signature-the-stack-cannot-carry`
- `test-that-cannot-reach-its-branch`
- `behavior-the-design-did-not-decide`
- `migration-order-cannot-build`
- `fix-changes-the-model`

The stop reasons that the writer workflow or the calling session gives:

- `stopped-without-a-reason`, which the writer workflow gives a writer that stopped with no stop or gave no answer.
- `build-failed`, which the calling session gives a finished group whose build failed, with the failing command as `says`.

A stop sends the abstraction it names back to the designer. The designer changes the model and runs the checks again, and the cut migration plans the group of the stop whole. A second stop on the same abstraction becomes a question in the mode with a user. In autonomous mode, it ends the plan with the outcome `stop` (`SKILL.md`, section 4, step 1).

```json
{ "reason": "behavior-the-design-did-not-decide", "at": "OrderErrorHandler#answerFailure", "says": "no status code", "plan": 1 }
```

## `existingDefects`

1 object per defect of an existing field or member of a class of a `modified` file, such as a field whose type admits values the business never has, which a shape run or the reading of the code shows. The review judges a changed class whole, so such a defect is inside the change: no reason class leaves it, also in autonomous mode, and the designer fixes it in the model. In the mode with a user, it is first a question whose recommendation is the fix (`design-decisions.md`, `questions`), and the object records the fix that the answer takes. Empty where no class of a `modified` file holds such a defect.

An existing gap on the path of an entry whose `changed` is true, such as an exit whose failure leaves an earlier effect in place, also takes 1 object (`design-boundaries.md`, `exits`). The designer fixes it, or writes it as not fixed: the object then holds `notFixed` with the reason, and no `fix` and no `group`, so the migration has no step for it. A defect of a field or of a public member of a class of a `modified` file is never written as not fixed.

| Key | Type | Required | Read by |
|---|---|---|---|
| `class` | display name of the class of the `modified` file, or of the class on the path that holds the gap | yes | design check, which resolves it; render; migration script |
| `member` | text: the name of the field or the method that holds the defect | yes | render, migration script |
| `defect` | text: the defect in 1 sentence | yes | render |
| `fix` | text: the fix in 1 sentence, which the model already holds | where the design fixes the defect | render, migration script |
| `group` | number: the migration group of the fix, which no class of the model takes | with `fix` | design check, which reports a `group` that a class of the model also takes (`existing-defect-group-taken`); migration script |
| `notFixed` | text: why the design leaves the gap, in 1 sentence | only for a gap on the path of a changed entry that the design does not fix, in place of `fix` and `group` | design check, which reports an object with both or neither of `fix` and `notFixed` (`existing-defect-fixed-and-not-fixed`, `existing-defect-neither-fixed-nor-not-fixed`); render, which prints `not fixed: <notFixed>` |

The migration script writes each such group apart, with the label `existing defect of the modified class` after its group number, and 1 step per object with `fix` in the migration stage changed members, `fixes <member> of <class>: <fix>`; the step of that member stands in no other group, so the step of changed members of its class ends with `, except <Class>#<member>, which group <n> fixes`. So the user reads the fix apart from the change. The render prints the objects in the section `## Existing defects of modified classes`. The object of `findings` for an item of a shape run on such a defect takes `closedBy`, which names the fix.

```json
{ "class": "RepairJob", "member": "labourMinutes", "defect": "bare int minutes", "fix": "type Minutes", "group": 3 }
```

## `scriptCases`

1 object per recheck case of the design check that the designer finds wrong against the model, so `design.md` shows it as a defect of the script. Empty where the designer finds none. The keys, all required:

| Key | Type | Read by |
|---|---|---|
| `code` | text: the code the check printed, such as `data-source-missing` | design check, render |
| `name` | display name: the abstraction the line of the check is about | design check, render |
| `text` | text: the whole rest of the line after its code and its display name, copied whole | design check, render |
| `reason` | 1 sentence that names what in the model shows the case wrong | render |

The design check matches an object with a line by its `code`, its `name` and its `text`, never by a JSON path or an array index, because an index changes when a class is added or removed. It marks only a line that matches all 3 `found-wrong` in place of `recheck`, so a new defect on the same abstraction stays open. A `found-wrong` line does not set exit 1, and the render prints each object in its own section. An object that matches no line prints as `not matched`, so the designer removes it (`design-checks.md`, section 1).

A `folder-cycle` line of a cycle that predates the change takes an object whose `reason` is `outside the change`, as a member does. The design check clears such a line only with `--repo`, where each edge of the cycle has a relation that stands in the base commit: the file of the class that refers names the class it refers to, and that class stands in its own file there. Where 1 edge has no such relation, or where no `--repo` is given, the line stays `recheck`, and the check prints the defect `outside-the-change-but-changed` with the edge.

```json
{ "code": "data-source-missing", "name": "Checkout#priceLines", "text": "line: no source", "reason": "loop variable" }
```

## Which script reads which key

The prepare command reads none of these keys, so no judge of the shape check reads them. The design check and the render read every key, as each table says. The migration script reads `existingDefects` alone.
