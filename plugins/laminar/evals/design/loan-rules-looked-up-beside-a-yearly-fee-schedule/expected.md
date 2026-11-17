# loan-rules-looked-up-beside-a-yearly-fee-schedule

## Level 1

- checkDesign: no defect
- No name holds: registry
- Model path absent: LoanRules
- Model path present: FeeSchedule
- No file moves except: ItemNotFoundException

## Level 2

- No created class of the model outside the `config` zone holds only the loan rules, under any name: no class outside the `config` zone whose only instance field is a list or a map of `LoanRule`, whatever its name, its `represents` or its reason under `decisions.scriptCases`. A class of the `config` zone, such as a record of the settings that the framework binds, is wiring, so the line does not read it. This line stands here in words because the grader has no Level 1 form for a type that holds only a collection, and a line on 1 word, such as the plan's word catalogue, passes a holder under another name. The plan calls the set "the catalogue of loan rules", and the head librarian changes it, so a designer can name an event of the business for it; the case shows whether the text holds the set to the form, "only 1 collection of another class of the model", before it asks for an event.
- The loan rules are a list or a map field of `LoanDesk`, or of the class that lends, built by the wiring from the settings and handed to it; the lookup by name is a method of that class, which fails with `UnknownLoanRuleException` on a missing name. The model gives that collection `represents` `support` where it gives it a type at all, with `for` naming the class that reads it.
- The fee schedule is a created class marked `represents` `domain object`, beside `Loan` and `Item`, with its valid-from day and its fee per day for each rule, and with `madeWhen` naming the yearly publication by the staff, such as "the library staff publish the fees of a new year". It is not marked `support`, and the model gives it no `partOf`.
- Every created class outside a test file, a failure type and the `config` zone carries `represents`.
- No class that the model marks `domain object` stands only as the return type of 1 call. The answer of the return operation of `ApiForLending` is a `carrier` at the api edge, with no `madeWhen`, and its name says that it is the answer of that call, such as a name that ends in Result. A type among the domain objects that is named for the act, such as `LoanReturn`, and that only that call returns, fails the line.
- At `ready`, the design check prints no line of `kind-does-not-fit` and no line of `type-holds-only-a-collection` on any class of the model.
