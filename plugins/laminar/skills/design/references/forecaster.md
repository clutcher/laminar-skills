# The inputs of the change forecaster

Contents: 1. When it runs · 2. What it gets · 3. The agent · 4. What the designer does with the answer · 5. What to expect of the forecast

## 1. When it runs

The designer starts the change forecaster once on the draft of pass 1, after `decisions.owners` lists every owner and before depth is decided (`SKILL.md`, section 4). Where a later shape run adds owners, start it again on the added owners only, and give it the earlier forecast lines as context; it never rewrites an earlier line. The designer decides the depth of an existing owner again only where its forecast line changed. Start it by section 3. The forecaster finds and the designer decides: it never proposes a shape, so the depth rule of `designing.md`, section 7, stays the only place where a boundary that hides a choice is added.

## 2. What it gets

The designer writes each input under its label, in this order, and nothing else, because the rules stand in the agent file:

- `Owners:` the owners of the draft model, 1 per line: its display name, its folder and its `decision` in the words of the business.
- `Input text:` the input text of the change, for the roadmap words it holds.
- `Documentation:` the paths of the documentation of the repository that names the domain, where the scope has some, such as the root `README.md`, or `none`.
- `Repository:` the path of the repository, where the forecaster counts the churn of each existing owner itself (section 3).
- `Earlier forecast:` only on a later start, the forecast lines of the earlier owners.

It reads no method body, so the call stays small.

## 3. The agent

The fixed rules of the forecaster stand in its agent file, `agents/design/design-forecaster.md` of the plugin, which is `../../agents/design/design-forecaster.md` from the folder of this skill: the order of evidence, the 3 horizons and the form of each forecast line. It counts the churn of each existing owner itself, by the 1 git command and the window that its file states, and it returns 1 JSON list with 1 object per owner. In Claude Code, start it as the agent type `laminar:design-forecaster` (the Agent tool, with `subagent_type`), whose file pins the model sonnet at medium effort. In a host with no agent of the plugin, start 1 subagent with the body of that file, below its frontmatter, as the start of its prompt, then the inputs of section 2. In a host with no subagent, follow that body yourself, and keep its order of evidence.

## 4. What the designer does with the answer

Write each object under the `forecast` of its owner in the design model, without the key `owner`. Then decide depth by `designing.md`, section 7, and write `depth` with `takenBy` set to `forecast` only where a forecast with evidence `roadmap` added the boundary, `designer` where the code or the minimum fix decided, and `user` where the user answered a question on depth. The designer reads every other line as a record and not as a reason for depth (section 5). In the mode with a user, a question on depth shows the forecast and recommends the minimum fix, and the user may override it. `design.md` prints each forecast beside its owner, and the depth as a decision with its reason, so a reader can revisit both.

The order of evidence is the book's: experience of the domain first, and the roadmap where experience does not reach.

- Book (*The Principles at Every Scale*, *Open-Closed Principle*): "When your experience does not cover the domain, ask stakeholders about their roadmap, and apply this thinking where you expect change in the next one to three years."
- Book (*The Principles at Every Scale*, *Open-Closed Principle*): "The full Open-Closed split earns its place only when new providers keep arriving"

## 5. What to expect of the forecast

Read each forecast line as an expectation, not as evidence: its `change` is the reading of the forecaster, not a fact, and a line whose evidence is `churn` or `none` is a guess, which counts toward nothing but the record. The forecaster was tested 2 times on the history of real code. On young code, where nearly every part changed within 1 year, the parts it rated high all changed. On mature code, its ratings did not tell the parts that changed from the parts that did not: the changes came from business rules that only that business has, and the parts that vary by their nature, such as prices, providers and channels, were rated high and did not change. So a forecast line adds depth only where the roadmap names a second answer (`designing.md`, section 7), and the next design on that code reads every other line as a record.
