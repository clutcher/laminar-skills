# Evaluation cases for the coding style skill

A case is a coding task on a small fictional codebase, and the review findings the written code may not draw. It measures whether code written with `laminar:code-style` passes `laminar:review`, which is the purpose of the skill.

Each case folder holds:

- `base.diff`: the codebase before the task, applied to an empty repository.
- `task.md`: the task, as an agent receives it.
- `expected.md`: the reader's file the review of the written code is graded against, in the same form as the cases under `../review/`, usually only a `## Must not appear` list.
- `judges.txt`, where the case has one: the judge types the review runs for this case, in the same form as the cases under `../review/`.

## Running a case

From a session, with `<case>` the case folder and `<dir>` a scratch folder outside this repository:

```bash
node evals/grade.mjs --build <dir> <case>
```

It commits the base on `main`, leaves `<dir>` on a branch named `change` and prints the path of `task.md`. Give that task to a coding agent working in `<dir>`, with the instruction to invoke `laminar:code-style` first, and for the comparison arm the instruction to invoke no skill. Commit what the agent wrote on `change`, review `main...change` with the 5 steps of the review skill, and grade the run:

```bash
node evals/grade.mjs <case> <run folder>/review.md
```

Where the case holds a `judges.txt`, run the prepare step of the review with `--judges` and the judge types of that file, which `node evals/grade.mjs --judges <case>` prints, so the run calls only the judges the case grades and costs little.

A case is run 1 at a time, and the next case only after the first one graded as expected, because 1 full review of a written change costs about 2M new tokens.

## The cases

| Case | What it asks for | What it shows |
|---|---|---|
| `lending-members-borrow-several-books-at-once` | Borrowing several books in 1 request with limits per membership tier and per book, and returning a loan, behind a REST controller with tests | Batch reads, a decision held once, rejection reasons, names that predict, tests through the entry boundary |
| `shipments-dispatched-through-one-entry-point` | 1 entry point that other modules call to dispatch a shipment into the open carrier batch, with a dispatch receipt and tests, in a module laid out as an app with its ways in and out, where no folder yet declares what other modules may call and the only dispatch code is a carrier dispatch folder with its batching folder | Each new file placed in the folder whose path names what it is a part of, and never in the nearest folder whose name matches the task, such as the carrier dispatch folder or its batching folder; an entry point other modules call declared by the app |
| `repair-jobs-finished-into-an-invoice-and-a-message` | Finishing a bicycle repair job with the labour minutes and the parts used, which now also saves an invoice with a labour line and 1 line per part and sends the customer a message with the invoice total, behind the existing finish endpoint, with tests, where the class that finishes the job already sends a message when it opens a job | Each new piece placed on its abstraction level: the code that runs the finish, the invoice and the message together sits in 1 abstraction above the class that finishes the job, which keeps to the job status; the price of the labour and of the parts sits with the invoice and not with the repair job; no boundary that hides nothing |
| `telescope-slots-moved-and-booked-at-night` | 6 behaviours of the night schedule of an observatory that books its telescopes, with unit tests: a new start of a slot cut at dawn, a slot given to another observer, a new schedule with 1 more slot that refuses an overlap, whether a telescope has no slot at a moment, the slots that start before midnight with no input, an observing report created in steps from the telescope, and the sort, equality and log form of a slot | Each method name starts with a verb, also where the method computes what it returns, and also the start of the report that takes the telescope, which never starts with a word that relates, such as from or of; a name that starts with with only for the copy of a slot with 1 new field, such as the slot with a new observer; no method name that ends in a preposition, with or without input, and no name that only adds the noun of its parameter after the preposition, so a verb takes its object with no preposition, or the preposition goes; a name whose noun after the preposition says what no parameter says, such as slots that start before midnight, is the form the rule wants; sort, equality and the log form keep the names the language fixes |
