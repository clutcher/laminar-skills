---
name: review
description: Reviews code for design quality against the 3 qualities of high-quality code in Laminar Software Design, which are simple to understand and change, correct in behavior, and fast enough for its purpose. Simplicity is judged by the cognitive failure a reader meets, correctness by the decisions that prevent errors and the tests that verify behavior, and performance by waste a known alternative avoids. Use when the user asks to review code, a pull request, a branch, a commit, files, a folder, or a module; asks whether code is simple, well named, well structured, well bounded, or well tested, whether its types allow invalid states, or whether it runs I/O in a loop; asks for a design review or an abstraction review of existing code; or names Laminar Code Review or asks to check code against the book. Prefer it over a general review when the question is about design rather than one specific bug. Not for a bug hunt or a quick look, because it does not find logic errors, judges waste and not speed, and takes minutes.
---

# Laminar Code Review

**You run 5 fixed steps in order, with 1 cost check between step 1 and step 2, and decide nothing else.** At the cost check the user decides and you pass the answer on. You pick the target and the 3 placeholders below, and every id, every file of the code under review and every agent belongs to the scripts and the 2 workflows.

**Say what you are reviewing in 1 short line before you start.** One line such as `Reviewing <remote>/<default>...HEAD in the orders service.` is the whole of it.

To answer a question about how the review works, what a track or a check judges, or what a section of a report means, read `<skill>/reference.md`. A running review never needs it.

## The 3 placeholders

| Placeholder | What you write for it |
|---|---|
| `<skill>` | the folder this file sits in |
| `<run>` | a new empty folder for this run, of your own, outside the tree under review |
| `<target>` | the user's tree, as an absolute path |

Keep the double quotes the commands below put around each placeholder, so a path with a space in it still works.

Choose the remote `<remote>` with git alone. Where `git remote` lists 1 remote, use it. Where it lists `upstream`, use `upstream`. Else use the remote of the upstream of the current branch, which is the part before the first `/` of what `git rev-parse --abbrev-ref --symbolic-full-name "@{upstream}"` prints. Else use `origin` where it is listed. Else ask the user.

Find the default branch `<default>` in this order, and never run `git remote set-head`: the name that `git symbolic-ref --short refs/remotes/<remote>/HEAD` prints, without its `<remote>/` start; else the name after `ref: refs/heads/` in what `git ls-remote --symref <remote> HEAD` prints; else `main` and then `master`, the first that `git rev-parse --verify --quiet <remote>/<name>` or `git rev-parse --verify --quiet <name>` finds; else ask the user.

The base is the default branch as the remote holds it. Run `git fetch <remote> <default>` before step 1, which moves no local branch and not the checkout, and use `<remote>/<default>` as the base, because a local default branch can be weeks old and then brings changes that are already merged into the review. Where the repository has no remote or the fetch fails, use the local default branch, and say in your first line that the base is local and can be old.

The first command takes 1 of `--range`, for a pull request, a branch, a commit, a tag or "my changes", with `<remote>/<default>...HEAD` or the base you were given where the user names none; `--files`, for named files, a folder, a module or a package; and `--diff`, for a patch text, and only where no tree is available. `--exclude` takes path prefixes the review leaves out entirely, which the banner then names as reviewed by nobody.

Where the user gives a range, such as `HEAD~1..HEAD` for 1 fix commit or 2 commit ids, pass it as it is: the base above is only for a review where the user names none. The review then marks only the hunks of that range as the change and judges only the abstractions they touch, and a range that changes only blank lines or formatting plans no check.

A range with 2 ends, such as `<remote>/<default>...HEAD`, reads only commits, so changes the user has not committed are not reviewed. Where the user asks for those changes too, pass 1 end only, such as `--range <remote>/<default>`: the script then compares that base with the user's checkout, which holds the changes not committed, and a new file that git does not track yet is still left out.

For a pull request or a branch, fetch its head first and pass the head as a ref where one exists, such as `--range <remote>/<default>...<remote>/<branch>`, and not as a bare commit id, because a later review of the same branch then uses the same worktree again. The script reads a range with 2 ends in a worktree of its own, never in the user's checkout.

Where the user names a pull request by its number, read it with git alone. List its refs with 1 call, `git ls-remote <remote> refs/pull/<number>/merge refs/pull/<number>/head refs/merge-requests/<number>/merge refs/merge-requests/<number>/head refs/pull-requests/<number>/merge refs/pull-requests/<number>/from`, because each host names them in its own way. Where a merge ref is listed, fetch it with `git fetch <remote> <that ref>`, read its 2 parents at once with `git rev-parse "FETCH_HEAD^1" "FETCH_HEAD^2"`, and pass `--range <first>...<second>`: the first parent is the target branch of the pull request and the second its head. Where only a head ref or a from ref is listed, as for a pull request with conflicts, fetch it, pass `--range <remote>/<default>...<the commit ls-remote listed for it>`, and say in your first line that the base is the default branch. Where no ref is listed, as on a host that publishes no pull request refs, ask the user for the name of the branch.

## Step 1, Prepare

Run both commands in 1 Bash call.

```bash
node "<skill>/scripts/runReview.mjs" extract --run "<run>" --repo "<target>" --range "<range>"
node "<skill>/scripts/runReview.mjs" prepare --run "<run>"
```

The extract command prints `run folder:` with the absolute path of the run folder. Use that path for `<run>` in every later step.

The prepare command prints a `RESULT` line and writes the same object to `<run>/prepare-return.json`. That object is the map the next step needs.

Where a command stops with an error, show its error line to the user and stop: run no later step and write no file in its place.

## The cost check, between step 1 and step 2

The `RESULT` object of the prepare command holds `costPlan`, 1 line that ends in `above the threshold of 500 calls or 2.0M new tokens: no` or `... : yes`. Where it ends in `no`, go on to step 2 at once and ask nothing. A review of a pull request almost always ends in `no`. Where it ends in `yes`, dispatch nothing yet: read `<skill>/cost-check.md`, do what it says, and only then go on to step 2. The same line names `judge workflow waves`, the number of calls step 2 makes to the judge workflow, which is 1 for almost every review. Before the threshold words, the same line also gives the cost of a run of the application, module and class scales only, under `application, module and class only`, where the run is not already limited to those scales.

## The task output of a Workflow call

The task output of every Workflow call below holds the object the workflow returns under `.result`, beside other keys such as `summary` and `logs`. Where a step writes a return to a file, write only that `.result` object, never the whole task output.

## Step 2, Screen and Judge

```
Workflow({ name: "laminar:laminar-review-judge", args: {
  runFolder: "<run>",
  prepared: <the RESULT object the prepare command printed>
} })
```

It returns the possible findings, the covered paths, the checks no judge ran, the counts and the I/O screen.

Where a Workflow call fails or its task output holds no `.result`, call it again once with the same arguments. Where it fails again, show the error to the user and stop. Never write a return file of your own.

**Where `waves` in the `RESULT` object holds more than 1 entry, call the judge workflow once per wave, one after the other, and never 2 at once.** Each call carries the same 2 arguments and `wave`, the number of the wave, 1 for the first call, then 2, and so on up to the number of entries in `waves`. Start a call only after the call before it has returned.

```
Workflow({ name: "laminar:laminar-review-judge", args: {
  runFolder: "<run>",
  prepared: <the RESULT object the prepare command printed>,
  wave: <N>
} })
```

As soon as a wave's call returns, write its `.result` with the Write tool to its own file, `<run>/returns/possible-findings-<N>.json`, where `<N>` is the number of the wave, and then start the next wave.

## Step 3, Merge

Write the `.result` of the judge workflow's task output with the Write tool to `<run>/returns/possible-findings.json`, then run the merge alone in 1 Bash call.

```bash
node "<skill>/scripts/runReview.mjs" merge --run "<run>" --findings "<run>/returns/possible-findings.json"
```

Where step 2 ran in more than 1 wave, every possible findings file is already written, so run only the merge, with every possible findings file after `--findings`, joined by commas and in the order of the waves.

```bash
node "<skill>/scripts/runReview.mjs" merge --run "<run>" --findings "<run>/returns/possible-findings-1.json,<run>/returns/possible-findings-2.json"
```

The merge command prints a `RESULT` line and writes the same object to `<run>/merge-return.json`. That object is the map step 4 needs.

Where the merge stops with an error, show its error line to the user and stop. Never change a possible findings file by hand to make the merge pass.

## Step 4, Verify

**Read `refuterCalls` under `counts` in the `RESULT` object the merge printed.** Where it is 0, no possible finding goes to a second read, so do not call the verify workflow: write `{"verdicts":[],"refutations":[],"notVerified":[]}` to `<run>/returns/verdicts.json` with the Write tool and go to step 5, where that file takes the place of the object the verify workflow returns. Else call it.

```
Workflow({ name: "laminar:laminar-review-verify", args: {
  runFolder: "<run>",
  merged: <the RESULT object the merge command printed>
} })
```

It returns `verdicts`, `refutations` and `notVerified`.

Where a Workflow call fails or its task output holds no `.result`, call it again once with the same arguments. Where it fails again, show the error to the user and stop. Never write a return file of your own.

**Where `verify` in the merge `RESULT` object holds `waves` with more than 1 entry, call the verify workflow once per wave, one after the other, and never 2 at once.** Each call carries the same 2 arguments and `wave`, the number of the wave, 1 for the first call, then 2, and so on up to the number of entries in `waves`. Start a call only after the call before it has returned.

```
Workflow({ name: "laminar:laminar-review-verify", args: {
  runFolder: "<run>",
  merged: <the RESULT object the merge command printed>,
  wave: <N>
} })
```

As soon as a wave's call returns, write its `.result` with the Write tool to its own file, `<run>/returns/verdicts-<N>.json`, where `<N>` is the number of the wave, and then start the next wave.

## Step 5, Report

Write the `.result` of the verify workflow's task output with the Write tool to `<run>/returns/verdicts.json`, then run the render alone in 1 Bash call.

```bash
node "<skill>/scripts/runReview.mjs" render --run "<run>" --verdicts "<run>/returns/verdicts.json"
```

Where step 4 ran in more than 1 wave, every verdicts file is already written, so run only the render, with every verdicts file after `--verdicts`, joined by commas and in the order of the waves.

```bash
node "<skill>/scripts/runReview.mjs" render --run "<run>" --verdicts "<run>/returns/verdicts-1.json,<run>/returns/verdicts-2.json"
```

Where the render stops with an error, show its error line to the user and stop.

**Then read `<run>/review.md` and show it in the conversation.** Name `review-evidence.md` beside it as the evidence, and do not repeat it. The items under `## To consider` are questions to the author and not findings, so pass them on as questions. `review.sarif` sits beside both for a tool that wants it. Where you pass the report on, into a pull request comment or anywhere else, carry the check name, the name of the abstraction and the fix word for word, because a paraphrase drops what the finding names.

**Never spawn an agent of your own and never write a file the steps above do not name.** A finding loses its quoted evidence at every hop.

## The models and the efforts

The model and the effort of every agent are set in its own agent file: Sonnet at low effort for `review-screen-presence` and `review-screen-io`; Sonnet for all 17 judges, at high effort for `review-judge-simplicity-class`, at medium effort for `review-judge-simplicity-variable` and `review-judge-correctness-test-plan`, and at low effort for the other 14; Sonnet at medium effort for `review-refuter`; and Opus at medium effort for `review-verifier`. The `models` and `effort` arguments of either Workflow call override them per role: the word `judge` moves all 17 judges together, the word `screen` moves both screens, the word `refuter` moves every refuter call, and the word `verifier` moves every verifier call. The word `judge` never moves the refuter.
