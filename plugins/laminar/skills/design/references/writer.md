# The inputs of the writer

Contents: 1. When it runs · 2. What it gets · 3. The agent · 4. What the designer does with a stop

## 1. When it runs

The designer starts 1 writer for each migration group, after the user approved `design.md` and the migration, or at once in autonomous mode (`SKILL.md`, section 4). In Claude Code, the writer workflow `laminar:laminar-design-writers` starts them: it reads `migration.workflow.js`, which the migration script writes beside the migration, starts each migration group after every earlier group it touches, because a later migration group builds on the code of an earlier one, and starts the groups that touch no earlier group side by side. 2 groups touch where a step of each lists the same file or a file under a folder the other lists, or where a class of one names a class of the other. Each writer runs as the agent type `laminar:design-writer`, whose file holds the rules of the writer (section 3), and its prompt holds only the inputs of section 2. In a host with no Workflow tool, start each writer as 1 subagent by section 3, in the order of the migration, and start the next one only after the one before it returned. In a host with no subagent, the session follows the body of the writer itself.

## 2. What it gets

- The path of `design.md` and of the migration, and the number of its migration group, whose steps alone it writes.
- The path of the repository.
- The open questions of the model whose `autonomous` is `open`, so the writer knows which code it may not write.
- Where a writer of the same migration group stopped before, the files it changed and left uncommitted, which this writer goes on from.
- In a round of the loop, the path of `review.md` of the round, whose findings the steps of the migration group name (`design-rounds.md`).

The writer workflow gives each input on its own line, in this order: `Design:`, `Migration:`, `Migration group:`, `Repository:`, `Open questions:`, `Files left by the writer before:`, `Review of the round:` in a round only, and `Commit: by the session`, because writers that run side by side share 1 index of git.

## 3. The agent

The fixed rules of the writer stand in its agent file, `agents/design/design-writer.md` of the plugin, which is `../../agents/design/design-writer.md` from the folder of this skill: it loads the skill `code-style` of the plugin laminar once before it writes, keeps every name of `design.md` and the conventions of `decisions.conventions` with their test name forms, writes the steps of its migration group in order, builds and runs the tests, and returns its files and its commit message, or 1 stop of a closed list of reasons. In Claude Code, the writer workflow starts it as the agent type `laminar:design-writer`, whose file pins its model, its effort and its tools. In a host with no agent of the plugin, start 1 subagent with the body of that file, below its frontmatter, as the start of its prompt, then the inputs of section 2.

Where the writer returns files and a commit message in place of a commit, the designer commits that migration group with that message before it starts the next writer. Either way, the review after the writers reads the range from the base commit of the change to the head (`SKILL.md`, section 4, step 12).

## 4. What the designer does with a stop

Write each stop as 1 object of `decisions.stops`, with the `round` of the writer. A stop sends the abstraction it names back to the designer: change the model, run the shape check on the changed part where the shape half changed, run the design check, render `design.md` again, and start the writer again for that migration group. The files of the writer that stopped stay uncommitted, and the next writer of that group goes on from them. The designer commits the group only when a writer finishes it. Where the writer stops a second time on the same abstraction, ask the user a question about it, with the 2 stops as its fact, in place of a third start; in autonomous mode, end the run with that stop as its result. The writer never decides a design problem alone, because a shape it chose would reach the review with no check before it.

- Book (*How to Verify Correctness*, *How to Produce Verified Code*): "Writing code often reveals design problems, so the developer returns to thinking, adjusts the decisions, and updates the code to match."
