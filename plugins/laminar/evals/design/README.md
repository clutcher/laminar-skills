# Evaluation cases for the design skill

A case is a small fictional repository with the input of the skill `design` of the plugin laminar, and the checks that its design model or its shape run must pass. There are 3 kinds of cases. A design case gives the skill a review run or a described change, and grades the design model the skill writes before any code is written. A shape case gives the review a shape model alone, and grades the `review.md` of 1 shape run. A writer case gives the writer workflow a stored design model, so no designer runs, and grades the code the writers write at level 2.

## What a design case holds

- `base.diff`: the repository before the change, applied to an empty repository.
- `change.diff`, where the input is a review run: the change that the review reviewed, as `main...change`.
- `review.md`, `review.sarif` and `review-evidence.md`, where the input is a review run: the 3 report files of 1 run of the skill `review` on that change. The findings are written by hand, and the 3 files are rendered by the extract, prepare, merge and render commands of the review scripts, so they have the exact form of a real run. Each case with a run folder also holds `prepare.json` of that run, because the design scripts read the judged findings of the run from it.
- `decided.json`, where the task gives a decided list: the findings of the review run that the calling session already decided, in the form of the input `decided: <file>` of the skill.
- `plan.md`, where the input is a described change: the plan text that the skill designs.
- `design-model.json`, in a writer case: the stored design model that the finish command plans and the writers write.
- `task.md`: the task, as an agent receives it, with `<run folder>`, `<plan file>`, `<decided file>` and `<results folder>` for the paths of the operator.
- `expected.md`: the checks of the design model, under `## Level 1` and `## Level 2`.
- `judges.txt`: the judge types of the review run of the inputs, which a level 2 review of the written code also runs, in the form `runReview.mjs prepare --judges` takes.

## The 2 levels

Level 1 grades `design-model.json` of the results folder at no model cost. `design.md` is not graded at level 1, because the render writes it from the model, so the model is the data. Each item under `## Level 1` is 1 check, in 1 of these forms:

| Line | It passes where |
|---|---|
| `checkDesign: no defect` | `scripts/checkDesign.mjs` of the skill, run with `--model` and `--repo <built fixture>`, and with `--review <case>/review.md` where the case has one, prints no line whose mark is `defect` |
| `Model path present: <path>` | 1 of 4 things of the model ends with `<path>`, compared by whole path segments and with no file extension: a folder path, a child of a folder, the `file` of a class, or the name of a class, which counts where `<path>` is 1 segment equal to that name |
| `Model path absent: <path>` | none of those 4 things ends with `<path>`; a folder or a child of kind `removed`, and the classes of its files, do not count, because the model lists a removed file |
| `New files: at most <n>` | at most `<n>` children of kind `created` with no `oldPath` |
| `Closed in 1 class: <numbers>` | 1 or more objects of `decisions.findings` with no `run` hold 1 of the numbers, each of them holds `closedBy`, and every such `closedBy` names the same class, alone or as `Class#member` |
| `No file moves` | no child of kind `moved` and no child with `oldPath` |
| `No name holds: <word>` | no folder segment, child, class, field or method name of the tree after the change holds `<word>` or its plural as a whole word, read by its camel case and compared with no regard to case |
| `Class text absent: <text>` | no text of a class of the tree after the change, its fields and its method bodies included, holds `<text>`; a text of `decisions`, such as a question that quotes the input, does not count |
| `Convention override: <project id>; <code-style id>` | 1 object of `decisions.conventions.overrides` of the kind `override` holds the 2 ids as `project` and `codeStyle`, compared with no backticks; where 2 or more code-style ids stand, joined by ` or `, either one matches |
| `Convention contradiction: <project id>; <code-style id>` | the same, for an object of the kind `contradiction` |

The model holds an object of `decisions.findings` only for an item at the application, module or class scale, so a method item has no object, and `Closed in 1 class` grades only the numbers that have one.

Level 2 is an agent grade, and only the writer case runs it, by its task and the run plan below. An agent reads the design model against the items under `## Level 2`: the cause of the findings, the owner of the decision in the tree of the model, and a review of the code that the writers write from the model, run on `main...change` with the judge types of `judges.txt`.

## Running a design case

From a session, with `<case>` the case folder and `<dir>` a new folder outside every git working tree:

```bash
node evals/grade.mjs --build <dir> <case>
```

It commits the base on `main`, and where the case has a `change.diff`, the change on a branch named `change`, which it leaves checked out. It writes no `base-commit.txt`; the start command of the skill writes `base-commit.txt` and `plan-commit.txt` into the results folder, so the design check with `--repo` reads the tree of the head of the change. A task with a run folder gives `base: main`, because the skill needs the base commit with a run folder. Copy the 3 report files or `plan.md` of the case, with `prepare.json` and `decided.json` where the case holds them, into a new folder outside `<dir>` and outside this repository, so the skill cannot reach `expected.md`. Give `task.md` to an agent in `<dir>` with the paths filled in, and with the instruction to invoke `laminar:design` first; GitHub Copilot CLI loads the skill by the name `design`. The task runs the skill in autonomous mode to the end of its plan, with at most 3 shape runs. The skill ends at the plan and starts no writer, so the task changes no file of the repository. A run costs about $9 per case, for the designer and its shape runs. Then grade the model at level 1, at no model cost:

```bash
node evals/grade-design.mjs <case> <results folder> --repo <dir>
```

It prints 1 line per check and a summary line, and exits 1 where a check failed.

A case whose task says that the designer runs as a subagent of the calling session is run so: the operator starts the designer as a subagent with no Workflow tool, and acts as the calling session. For each run folder that the designer returns after the prepare command, the operator runs the judge workflow, the verify workflow, the merge and the render of the skill `review` on it, as its steps 2 to 5 say, and sends the designer the run folder with the measured cost of the 2 workflows, such as by a message to the same agent (`SendMessage`, in Claude Code). The cost of such a run holds these shape runs too. A run that measures skill text that is not installed yet, such as a run of a case added with that text, installs no new version of the plugin for it: it gives the designer the path of `SKILL.md` of the tree that holds that text, to read with the files it names, in place of loading the skill, and the record of the run says that the designer did not load the skill.

## The shape cases

A shape case holds `shape.json`, the shape model of a planned change, a `base.diff` that creates only a `README.md`, because a git repository needs 1 file and the shape creates every Java file, `judges.txt` and `expected.md`. Its `expected.md` is written in the shape of the review's own `review.md`, by the rules of `evals/README.md`, *The expectation is written in the reader's own shape*.

Build the fixture with `grade.mjs --build`, and run 1 shape run on it with the 5 session steps of the skill `review`, where step 1 runs:

```bash
node runReview.mjs prepare --run <run> --repo <dir> --shape <case>/shape.json --scales method,class --judges <list of judges.txt>
```

The judge workflow, the merge and the render follow as in a review. A run costs about $0.15 per case. Then grade it:

```bash
node evals/grade.mjs <case> <run>/review.md
```

## The writer case

The writer case `hold-limit-checked-over-a-cached-catalogue` measures the self-check of the writer workflow (`references/writer.md` of the skill, section 5): arm A runs today's workflow with `selfCheck: false`, arm B runs it with the self-check, on the same stored model, 3 runs per arm. The model gives each decision 1 owner, so the case measures what the self-check catches in the code that only the writer names: the test helpers, the substitute, the private steps and the locals. Its repository is JavaScript with no dependency, and `npm test` runs the tests with the test runner of Node. Build the fixture with `grade.mjs --build`, then follow `task.md` from a session, which starts the writer workflow itself. Grade the model at level 1 with `grade-design.mjs`, and read each line under `## Level 2` against the return of the writer workflow, `plans/1/self-check.json` and the `review.md` of the closing review. A run costs about $1.4 in arm A, the writer and the closing review with the 4 judges of `judges.txt`, and about $2.3 in arm B, which adds the self-check and 1 answer round. The model declares `ExitCode`, the type of the field `exitCode` of `CommandAnswer`, as a closed set in the file of `CommandAnswer`. The model of the recorded runs typed that field with `ExitCode` and declared no such type, so each writer of those runs declared it, and a new run reads a model that the recorded runs did not read.

## The cases

| Case | Kind | Input | What it shows |
|---|---|---|---|
| `fee-files-moved-into-the-appointment-folder` | design | A review run with 1 module finding: the folder `appointment` holds 2 files of the fee of a visit that the change moved in from `billing` | The model gives the moved files a folder named for their part, or puts them back |
| `helpers-of-three-callers-gathered-in-a-utility-class` | design | A review run with a module finding on a folder `util` and a class finding on `ClinicUtils`, which holds 6 helpers of 3 callers | The model groups the helpers by their callers and never splits them into 1 file per helper |
| `contact-channel-chosen-in-two-reminder-methods` | design | A review run with a class finding on `ReminderSender` and 2 method findings on its send methods, all from 1 cause, the contact channel that has no name | 1 class of the model closes the findings |
| `reminder-mailer-that-also-renews-loans` | design | A review run with a class finding on `ReminderMailer`, which sends reminders and also renews loans, 2 method findings on its send method and 1 on its date format, a decided list, a relayed schedule that the tree contradicts, a fix table of the calling session, a described copy of the reminders to the staff and a vendored mail library with documented limits; the designer runs as a subagent with no Workflow tool | The model moves the renewal to its owner instead of a new name, takes no rejected word and no relayed fact, decides the limits of the library before the plan, and creates no second type of a loan |
| `described-validator-that-only-reads-a-referral` | design | A plan that adds the class `ReferralValidator`, whose method only answers whether a referral covers a day | The model answers the described shape with a name that says what the method answers, and moves no file |
| `lab-order-names-under-project-conventions` | design | A plan that adds a lab order with a new web call and the class `FastingValidator`, which also fills in a missing sample time, in a repository whose conventions folder holds a rule that names the types of a call with the suffix Body and a rule that puts each check of a lab order and the correction it needs in 1 class named Validator, whose paths match only the new folder | The model lists both conventions files, follows the Body rule as an override of a rule of the skill marked narrower than the book, and records the Validator rule as a contradiction of a design direction of the book, which the tree follows The case grades the clash by the contradiction record and by Level 2, and not by the absence of a class name, because a design that keeps a check under the name of the project rule and moves the correction apart is the right design. |
| `due-date-rule-inline-in-three-loan-methods` | shape | A shape model where the 3 public methods of `LoanDesk`, lend, renew and transfer, each hold the rule of the due date inline, with no private part | The shape run raises Unnamed Part Failure on each of the 3 methods; a finding on a name of `Item` or a prediction on `transfer` is an honest finding the case does not measure |
| `hold-limit-checked-over-a-cached-catalogue` | writer | A stored model of 1 migration group: a command that places a hold on a title, a desk that checks the hold limit of the tier of the member through a new public method of `MemberCard`, and a cache over a remote catalogue, with 8 integration tests over a substitute of the catalogue | The self-check of arm B catches what it can in the code that only the writer names, which is the test helpers, the substitute, the private steps and the locals, and the closing review of arm B keeps no name or unnamed-part finding on the substitute or the test helpers |
| `due-date-rule-named-as-a-private-part` | shape | The same shape model, where the 3 methods name the private part `calculateDueDate` | The shape run raises no finding |

The measured shape runs raised Unnamed Part Failure on 8 of the 9 methods of the first shape case in 3 runs, so that case fails about 1 run in 3 by known variance.

## Where the code came from

The design cases are written fresh in a fictional clinic domain or a fictional lending library, in Java, so they can be published. The vendored mail library of 1 case is fictional too. The possible findings that the judges return behind the review files of each design case are written by hand, and the merge and the render that turn them into those files are the real review scripts, so no finding of a case is the answer of a judge.

The shape cases are written fresh in a fictional library domain, as shape models with Java bodies, so they can be published. The writer case is written fresh in a fictional lending-library domain, in JavaScript, so it can be published.
