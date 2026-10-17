# Evaluation cases for the convention check

A case is a small fictional repository with project convention files under `.claude/rules/conventions/`, a change on a branch named `change`, and the findings `laminar:check-conventions` must report and must not report on that change.

Each case folder holds:

- `base.diff`: the repository before the change, applied to an empty repository, with its project convention files.
- `change.diff`: the change the check is given.
- `expected.md`: the findings the report must hold, each as a place and the id of its rule, the findings it may hold, and the findings it must not hold.

## Running a case

From a session, with `<case>` the case folder and `<dir>` a new folder outside every git working tree:

```bash
node evals/grade.mjs --build <dir> <case>
```

It commits the base on `main`, commits the change on a branch named `change` and prints `main...change`. Run `laminar:check-conventions` in `<dir>` with the argument `change`, and once more with `change scales: module,class` to test the scale filter. Grade the report by hand against `expected.md`: each item under `## Must appear` is a hit where a finding names its place, 1 of its ids and its scale, and each line under `## Must not appear` is clean where no finding matches it. `grade.mjs` does not grade it, because it grades only the reader file of a review.

## The cases

| Case | What it plants | What it shows |
|---|---|---|
| `loan-renewal-under-project-overrides` | In a fictional library, in Java with Spring: a fee held as a bare decimal against a project rule, a storage method named with a business verb, a qualifier on a domain service, a bare renewal limit, a README in the application folder, Optional allowed by a project rule against `java.md`, a new project rule that splits methods by a count of lines, and an unchanged wildcard import | Every break is reported on its changed line with the id of its rule; a project convention wins over a rule of the skill without a finding; a project convention against a direction of the book is reported once, on the convention file; an unchanged line and a clean changed file draw no finding |
