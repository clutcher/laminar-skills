# loan-rules-looked-up-beside-a-yearly-fee-schedule

## Level 1

- checkDesign: no defect
- No name holds: registry
- Model path absent: LoanRules
- Model path present: FeeSchedule
- No file moves

## Level 2

- No created class of the model holds only the loan rules, under any name: no class whose only instance field is a list or a map of `LoanRule`, whatever its name, its `represents` or its reason under `decisions.scriptCases`. This line stands here in words because the grader has no Level 1 form for a type that holds only a collection, and a line on 1 word, such as the plan's word catalogue, passes a holder under another name. The plan calls the set "the catalogue of loan rules", and the head librarian changes it, so a designer can name an event of the business for it; the case shows whether the text holds the set to the form, "only 1 collection of another class of the model", before it asks for an event.
- The loan rules are a list or a map field of `LoanDesk`, or of the class that lends, built by the wiring from the settings and handed to it; the lookup by name is a method of that class, which fails with `UnknownLoanRuleException` on a missing name. The model gives that collection `represents` `support` where it gives it a type at all, with `for` naming the class that reads it.
- The fee schedule is a created class marked `represents` `domain object`, beside `Loan` and `Item`, with its valid-from day and its fee per day for each rule, and with `madeWhen` naming the yearly publication by the staff, such as "the library staff publish the fees of a new year". It is not marked `support`, and the model gives it no `partOf`.
- Every created class outside a test file, a failure type and the `config` zone carries `represents`.
- At `ready`, the design check prints no line of `kind-does-not-fit` and no line of `type-holds-only-a-collection` on any class of the model.
