# The brief of the writer

Contents: 1. When it runs · 2. What it gets · 3. The brief · 4. What the designer does with a stop

## 1. When it runs

The designer starts 1 writer for each migration group, after the user approved `design.md` and the migration, or at once in autonomous mode (`SKILL.md`, section 4). In Claude Code, the writer workflow `laminar:laminar-design-writers` starts them: it reads `migration.workflow.js`, which the migration script writes beside the migration, starts each migration group after every earlier group it touches, because a later migration group builds on the code of an earlier one, and starts the groups that touch no earlier group side by side. 2 groups touch where a step of each lists the same file or a file under a folder the other lists, or where a class of one names a class of the other. Its prompt names this file on the line `Writer brief:`, and the writer follows the brief of section 3. In a host with no Workflow tool, start each writer as 1 subagent, in the order of the migration, and start the next one only after the one before it returned. In a host with no subagent, the session follows the brief of section 3 itself.

## 2. What it gets

- The path of `design.md` and of the migration, and the number of its migration group, whose steps alone it writes.
- The path of the repository.
- The open questions of the model whose `autonomous` is `open`, so the writer knows which code it may not write.
- Where a writer of the same migration group stopped before, the files it changed and left uncommitted, which this writer goes on from.
- In a round of the loop, the path of `review.md` of the round, whose findings the steps of the migration group name (`design-rounds.md`).

The writer workflow gives each input on its own line, in this order: `Writer brief:`, `Design:`, `Migration:`, `Migration group:`, `Repository:`, `Open questions:`, `Files left by the writer before:`, `Review of the round:` in a round only, and `Commit: by the session`, because writers that run side by side share 1 index of git.

## 3. The brief

Copy this text into the prompt of the subagent, then the inputs of section 2:

```text
You write the production code and the tests of 1 migration group of a design that is already decided.

1. Load the skill code-style of the plugin laminar (laminar:code-style in Claude Code, code-style in GitHub Copilot CLI) before you write, and follow it whole.
2. Read design.md whole, then the steps of your migration group in the migration. Write the steps in their order. The code builds and its tests pass at the end of your migration group; a step in between may leave a caller to a later step of the group.
3. Keep every name that design.md gives: each folder, file, class, public member and named private part, with its signature. Write the bodies. You may add a private method below a named part where code-style asks for one; that is a detail and needs no stop. Where design.md leaves out a getter of a field it lists, or the text of a failure, write it yourself and list each under "filled" in your report; that needs no stop either.
4. Write each failure line, each check of an entry and each test that design.md names, with the test names it gives. Write each test name that you add in 1 of the forms of `decisions.conventions.testNameForms` in design-model.json, which stands beside design.md; where the model holds no such form, write it in the form of code-style: should, the outcome, when, the condition, in the casing of the language. A step that says `fixes finding <number> of round <n>: <check> on <display name>` names 1 finding of the review.md of that round: read the finding, and fix it inside the bodies or the tests of its class. Where the fix needs a change of a name, a signature, a file or a folder, stop with fix-changes-the-model.
5. Never rename, move, add or remove a public name alone, and never write code across an open question.
6. After the last step, build the code and run the tests of your migration group, and fix what they show inside the bodies. Where a test fails because a step of yours changed what it constructs or calls, fix or remove that test by the step that names it; a test case that a designed test of your group covers is removed, not kept. Where a test fails because the design changed the behavior it expects and no step names that test, stop with behavior-the-design-did-not-decide: that is a gap of the design, not a break of the build.
7. Make 1 commit for your migration group on the current branch, with a message that names the group. Where the host refuses a git write of yours, such as by a hook, or your inputs hold `Commit: by the session`, make no commit, and return the list of files you changed with the commit message. Never push, and change no file outside the steps of your migration group.

Where the design cannot be written as it stands, stop at once: a gap that is a type, a placement or a response. Write no workaround and choose no new shape. Return 1 stop object, with 1 reason of this closed list:
- input-nothing-provides: a part needs a value that no parameter, field or earlier call of its caller provides.
- signature-the-stack-cannot-carry: the language or the framework cannot hold a signature as design.md writes it.
- test-that-cannot-reach-its-branch: a named test cannot reach the branch it names through the entry it names.
- behavior-the-design-did-not-decide: the code needs a decision that design.md does not state, such as a status code or the order of 2 effects.
- migration-order-cannot-build: your migration group cannot build at its end in the order of the migration, because it needs code that a later migration group writes.
- fix-changes-the-model: the fix of a finding that a step of a round names needs a change of the design model, such as a name, a signature, a file or a folder.

The stop object: {"reason": <1 reason of the list>, "at": <the display name, Class#method or Class>, "says": <1 sentence on what you met>}.

Where you finish, return the commit id, or the files and the commit message where you could not commit, the steps you wrote, the build command with its result, each test command you ran with its result, and the list "filled": each getter and each text of a failure you wrote that design.md left out, with its display name. Where you stop, commit nothing: leave your files as they are, and return the stop object, the steps you finished before it, the files you changed, and the build and the tests you ran, with the build result `not run` where you built nothing.
```

Where the writer returns files and a commit message in place of a commit, the designer commits that migration group with that message before it starts the next writer. Either way, the review after the writers reads the range from the base commit of the change to the head (`SKILL.md`, section 4, step 12).

## 4. What the designer does with a stop

Write each stop as 1 object of `decisions.stops`, with the `round` of the writer. A stop sends the abstraction it names back to the designer: change the model, run the shape check on the changed part where the shape half changed, run the design check, render `design.md` again, and start the writer again for that migration group. The files of the writer that stopped stay uncommitted, and the next writer of that group goes on from them. The designer commits the group only when a writer finishes it. Where the writer stops a second time on the same abstraction, ask the user a question about it, with the 2 stops as its fact, in place of a third start; in autonomous mode, end the run with that stop as its result. The writer never decides a design problem alone, because a shape it chose would reach the review with no check before it.

- Book (*How to Verify Correctness*, *How to Produce Verified Code*): "Writing code often reveals design problems, so the developer returns to thinking, adjusts the decisions, and updates the code to match."
