# The brief of the change forecaster

Contents: 1. When it runs · 2. What it gets · 3. The brief · 4. What the designer does with the answer · 5. What to expect of the forecast

## 1. When it runs

The designer starts the change forecaster once on the draft of pass 1, after `decisions.owners` lists every owner and before depth is decided (`SKILL.md`, section 4). Where a later shape run adds owners, start it again on the added owners only, and give it the earlier forecast lines as context; it never rewrites an earlier line. The designer decides the depth of an existing owner again only where its forecast line changed. Start it as 1 subagent on the model sonnet at medium effort (the Agent tool, in Claude Code). In a host with no subagent, answer the brief of section 3 yourself, and keep its order of evidence. The forecaster finds and the designer decides: it never proposes a shape, so the depth rule of `designing.md`, section 7, stays the only place where a boundary that hides a choice is added.

## 2. What it gets

- The owners and the parts of the draft model: for each owner, its display name, its folder and its `decision` in the words of the business.
- The input text of the change, for the roadmap words it holds.
- The documentation of the repository that names the domain, where the scope has some, such as the root `README.md`.
- Only for existing code, and only as support: the churn of each folder and file of the scope, as the commits that touched it in the last 12 and 36 months, which the designer counts with git. A new part has no churn.

It reads no method body, so the call stays small.

## 3. The brief

Copy this text into the prompt of the subagent, then the inputs of section 2:

```text
You forecast how likely each owner below is to change. You never propose a shape, a class, an interface or a folder.

For each owner, return 1 JSON object with these keys, in the form of the key `forecast` of the design model:
- owner: the display name, as given.
- sixMonths, oneYear, threeYears: each low, medium or high, never a number, because a number from knowledge is a guess that looks exact.
- change: 1 of new variant, new rule, new caller, replaced technology, removal.
- evidence: 1 of domain, roadmap, churn, none.
- reason: 1 sentence that names the fact of the domain or quotes the roadmap words.

Weigh the evidence in this order, and name the strongest kind you used:
1. domain: what this kind of thing is known to do in every business of its domain. Outside providers and their rules, regulation, prices, taxes, discounts, channels and outside formats change by their nature, so rate them high from the domain alone where the owner holds one.
2. roadmap: a statement of the input text that names a coming change.
3. churn: the commits of the existing code, as support only. Churn never raises a forecast above what the domain or the roadmap gives. Where the domain calls a part stable and its churn is high, write medium and say in the reason that the churn more likely shows a wrong boundary than a changing domain.
4. none: no domain fact, no roadmap word and no churn.

Look 1 to 3 years ahead; the 6-month band serves only the question whether the smallest fix is enough. Rate high only where you can name the fact; a forecast of high on every owner says nothing. A forecast whose evidence is churn or none is a guess, and the reason must say so.

Return only the JSON list.
```

## 4. What the designer does with the answer

Write each object under the `forecast` of its owner in the design model, without the key `owner`. Then decide depth by `designing.md`, section 7, and write `depth` with `takenBy` set to `forecast` only where a forecast with evidence `roadmap` added the boundary, `designer` where the code or the minimum fix decided, and `user` where the user answered a question on depth. The designer reads every other line as a record and not as a reason for depth (section 5). In the mode with a user, a question on depth shows the forecast and recommends the minimum fix, and the user may override it. `design.md` prints each forecast beside its owner, and the depth as a decision with its reason, so a reader can revisit both.

The order of evidence is the book's: experience of the domain first, and the roadmap where experience does not reach.

- Book (*The Principles at Every Scale*, *Open-Closed Principle*): "When your experience does not cover the domain, ask stakeholders about their roadmap, and apply this thinking where you expect change in the next one to three years."
- Book (*The Principles at Every Scale*, *Open-Closed Principle*): "The full Open-Closed split earns its place only when new providers keep arriving"

## 5. What to expect of the forecast

Read each forecast line as an expectation, not as evidence: its `change` is the reading of the forecaster, not a fact, and a line whose evidence is `churn` or `none` is a guess, which counts toward nothing but the record. The forecaster was tested 2 times on the history of real code. On young code, where nearly every part changed within 1 year, the parts it rated high all changed. On mature code, its ratings did not tell the parts that changed from the parts that did not: the changes came from business rules that only that business has, and the parts that vary by their nature, such as prices, providers and channels, were rated high and did not change. So a forecast line adds depth only where the roadmap names a second answer (`designing.md`, section 7), and the next design on that code reads every other line as a record.
