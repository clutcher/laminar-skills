# The rounds of the loop

Contents: 1. What a round is · 2. The dispositions · 3. The round script · 4. The counts and the comparison · 5. Still-open keys · 6. The defects · 7. The loop line and the send line · 8. The migration of a round

## 1. What a round is

A round is 1 pass of the writers, with the review after it. The loop repeats rounds until the loop line of the round script says pass or stop (`SKILL.md`, section 4, step 12). Round 1 reviews `<base commit>..HEAD` at the application, module and class scales. A later round reviews `<head of round n-1>..HEAD`, where `rounds/<n-1>/head-commit.txt` holds the head of round n-1. A round whose fixes moved, created or split a file reviews `<base commit>..HEAD` again, because a review of the short range reads a moved file as new code. Where the round script lists a finding key as `still open`, widen the range or the paths of the next review so that it judges that key again, because pass needs it judged.

## 2. The dispositions

A disposition is what a round decides for 1 finding. Write 1 disposition for each item of `review.md`, by what the fix of the finding changes:

- To the designer, `"to": "designer"`, where the fix changes the tree, a signature or a placement. A finding at the application or module scale always goes to the designer, because it judges a placement.
- To the writer of a migration group, `"to": "writer"`, where the fix stays inside a body. The script takes the group of the class of the finding from `--model`, else group 1.
- A reason class, `"reason"` with `"says"`: `outside the change` or `project convention`, which the script checks. In the mode with a user, also `question to the author`, `exempt by the book` or `fix apart`.
- Closed by an answered question, `"question"` with the id of a question of the model that holds an answer.

The dispositions file is a JSON list with 1 object per item: `number`, the number of the item; `check`, only where 1 item holds 2 checks with 2 dispositions; and exactly 1 of `to`, `reason` and `question`.

```json
[ { "number": 1, "to": "designer" }, { "number": 2, "check": "S5", "to": "writer" }, { "number": 2, "check": "S2", "reason": "outside the change", "says": "base message kept" }, { "number": 3, "question": "payment-request-form" } ]
```

A carried finding returns with the reason class or the answer that its finding key held in an earlier round, and it needs no new disposition.

## 3. The round script

`node scripts/recordRound.mjs --results <results> --run <run folder> [--dispositions <file>] [--model <results>/design-model.json] [--repo <repository>] [--autonomous] [--dollars <measured>] [--round <n>] [--ceiling <rounds>] [--no-findings]`

- It writes `<results>/rounds/<n>/`: copies of `review.md` and `review.sarif`, `judged.json` with each finding key the run judged, `dispositions.json` with 1 object per finding, `counts.json` with the counts, the comparison, the loop line and the state of each finding key, `design-model.json`, a copy of the model, with `--model`, and `head-commit.txt` with `--repo`.
- `<n>` is 1 more than the last round. `--round <n>` writes round `<n>` again, after you fixed its dispositions.
- `--no-findings` reads a run that kept nothing and has no `review.sarif`. `--ceiling` stands only where the input of the run states a ceiling of rounds, never as a default. `--dollars` takes the measured cost of the round, the writers and the review together. `--autonomous` allows only the 2 reason classes that the script checks. With `--repo`, the script also reads `base-commit.txt` of the results folder.
- It exits with 1 where it prints a defect line, and it still writes the round. It exits with 2 on a usage error, on a run folder with no `review.sarif` and no `--no-findings`, and on a failed git command.

## 4. The counts and the comparison

A finding is 1 result of `review.sarif`. Its finding key is its display name (`properties.abstraction`) and its check (`properties.check`). The counts are per finding, and every comparison is per finding key, so 2 findings of 1 check on 1 class are 2 in the counts and 1 finding key in the comparison. The script prints the text of a finding and never matches it, because a judge writes new words for the same problem in each run. The match of the design check by name, code and text stays for the lines of a script, because a script repeats its lines byte for byte.

The judged keys come from `prepare.json` of the run folder: the display name of each code under review with the id of each of its checks. A finding key that a round did not judge, by its scale, its paths or its judge types, is not judged again, and never vanished.

A finding is open where it holds no reason class and no answer and is not carried, so a finding sent to the designer or a writer is open until a review judges the fix. With `--model`, the open count holds every finding at the application, module and class scales, and a method or variable finding only on a class that `entries[].handler` or `exits[].from` of the model names.

The output, tab-separated where a script reads the line:

```text
round: 2 · run: <path> · scales: application, module, class · judged keys: <k>
counts: findings 5 · open 7 · with a reason 0 · closed by an answer 0 · carried 0 · to the designer 0 · to the writers 0 · still open, not judged 2
compared with round 1: judged in both <k> · vanished 0 (closed by a fix 0, no fix step 0) · not judged again 4 (still open 2, closed by the model 0) · appeared 5 (on keys judged in round 1: 3, carried: 0)
fix-created files: not checked, no --repo
open on keys judged in both rounds: 0 then 3
dollars: this round not given · so far not given
not judged<TAB>still open<TAB><display name><TAB><check><TAB><text>
defect<TAB><code><TAB><display name><TAB><text>
send<TAB>designer<TAB><display name><TAB>open in rounds 1 and 2: S5, S2; 1 design problem
loop<TAB>stop<TAB>no-lower-count<TAB>the open count on keys judged in both rounds rose from 0 to 3
```

- A vanished finding is a finding of round n-1 on a finding key that round n judged and did not raise: closed by a fix where round n-1 sent it to the designer or a writer, else with no fix step.
- An appeared finding is a finding of round n whose finding key round n-1 did not raise.
- A fix-created file has the status `A` or `R` in `git diff --name-status --find-renames <head of round n-1>..HEAD`. The line gives the share of the appeared findings on such files, and prints `not checked` with no `--repo`.

## 5. Still-open keys

A finding of round n-1 sent to the designer or a writer whose finding key round n did not judge is still open: it counts as open, and pass cannot stand while it is open, because no review has judged the fix. It stays open in later rounds until a round judges its key, which then closes it or raises it again. With `--model`, the script reads the abstraction of each still-open key in the model:

- Where the model removes the abstraction explicitly, the key is closed by the model, because no review of the change can judge it: a method that `removed` of its class lists, a class that `removedClasses` of a file child lists, or a folder or a file of kind `removed`.
- Where the model renamed the abstraction, by `oldName` of a class or a method or by `oldPath` of a folder, the key is closed by the model, and the script prints the new key, which stays still open until a round judges it.
- Where the model marks the abstraction `unchanged`, the key stays open, and the script prints the defect `open-finding-on-unchanged-abstraction`. Give the finding a reason class, or change the model.
- Where the model holds the abstraction nowhere, and neither removes it nor renames it, the key stays open, and the script prints the defect `open-key-absent-from-model`. Record the removal or the rename in the model, or give the finding a reason class.

## 6. The defects

1 line each, with exit 1: `disposition-missing`, only where the loop line is continue; `disposition-number-unknown`; `disposition-reason-outside-list`; `disposition-not-autonomous`, a reason other than the 2 checked ones with `--autonomous`; `outside-the-change-but-changed`, with `--repo`, a place of the finding that `git diff <base commit>..HEAD` changed; `project-convention-on-a-book-rule`, for every check of the review today, because each rests on the book; `question-unanswered`; `placement-finding-to-writer`; `open-finding-on-unchanged-abstraction`; and `open-key-absent-from-model`.

## 7. The loop line and the send line

The last line of the round script is the loop line, and the first rule that matches decides it:

1. `pass open-count-zero`: no finding is open. End the loop and report.
2. `stop closed-finding-returned`: a finding key that a fix closed in an earlier round appears again, also under a new name or in a new folder. The key follows the model: a class or a method follows its `oldName`, and its name in the model of the round before where the designer renamed it between rounds, which no `oldName` records because the base never held the name: a class gone from that model with 1 added class of the same file or the same method names, or a method gone from its class with 1 added method of the same parameter types and return type. A folder follows the former folder of each class moved into it, by the `oldPath` of its file or by its folder in the model of the round before, from the new folder up to the folder that holds both. The same check on such a former name counts as a return where its key was sent, still open, closed by a fix or closed by the model, and this round did not raise it. A key on an abstraction that such a rename between rounds removed is closed by the model, renamed, never `open-key-absent-from-model`. A carried finding is no return.
3. `stop ceiling-reached`: the round reached `--ceiling`. This is the only code that is no finding of the design.
4. `stop open-after-designer`: a display name that a send line sent back in round n-1 is open again in round n.
5. `stop new-findings-on-fix-created-code`: more than 50 percent of the appeared findings stand on fix-created files.
6. `stop no-lower-count`: the open count on the keys that both rounds judged is above 0 and not below that of round n-1.
7. `continue first-round`, and then `continue open-findings-remain`: apply the dispositions and start the next round.

On a stop, end the loop with its code and its text. In the mode with a user, ask the user what to do, with the counts and the dollars so far.

A send line stands where a display name holds an open finding in round n-1 and in round n, under any check, the first time. Send its findings to the designer as 1 design problem. Where the display name is open in the round after the send line, the loop line is `stop open-after-designer`.

## 8. The migration of a round

The designer changes the model and never code. For each round, run the class check on the classes it changed (`--scales class --paths <files>` on the prepare command of the skill `review`), the design check and the render. Then plan the migration of the round:

`node scripts/planMigration.mjs --model "<results>/design-model.json" --out "<results>/migration.md" --round "<results>/rounds/<n>" --classes <changed classes>`

`--classes` lists the classes the designer changed in this round, by display name, separated by commas, and the script reads `dispositions.json` of the round. It plans only the migration groups that hold a changed class or a finding sent to a writer, in the order of the group numbers: the steps of the changed classes, and 1 step per finding sent to the group, `fixes finding <number> of round <n>: <check> on <display name>`, in the migration stage bodies, or tests for a finding on test code. The head line names the planned groups. A class of `--classes` that the model does not hold is the defect `changed-class-not-in-model`, with exit 1. With neither option, the script plans every group.

`node scripts/renderDesign.mjs --model "<results>/design-model.json" --out "<results>/design.md" --rounds "<results>/rounds"` adds `## Rounds` to `design.md`: 1 row per round with the counts, the loop line, the dollars of the round and the dollars so far.
