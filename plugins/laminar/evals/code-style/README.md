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
| `shipments-dispatched-through-one-entry-point` | 1 entry point that other modules call to dispatch a shipment into the open carrier batch, with a dispatch receipt and tests, in a module laid out as an app with its ways in and out and a carrier batching folder | Each new file placed in the folder whose path names what it is a part of, and never in the nearest folder, such as the batching folder; an app that imports no code of its ways out |
