# loan-renewal-under-project-overrides

The change is `main...change`, checked with the argument `change`. A place names the file and the line at the head of the change. Where 2 ids stand after a place, either one matches. Each item names its scale, which the finding must carry as the last word of its first line, after ` · `. With the argument `change scales: module,class`, only the items of scale `module` or `class` must appear, and the first line of the report must name `method` and `variable` with the number of findings left out at each.

## Must appear

1. `RenewalReceipt:6`, `project loans.md §2`, scale `variable`: the renewal fee is a bare decimal and not a Money value.
2. `LoanRepository:14`, `code-style spring.md §10`, scale `method`: the storage method `searchByMember` takes the business verb search where the storage verb find is due.
3. `LoanRenewalService:25`, `code-style spring.md §4` or `code-style spring.md §3`, scale `class`: a qualifier on the constructor parameter of a domain service chooses the notifier bean, a choice of the module configuration.
4. `LoanRenewalService#renewLoan:33`, `code-style pitfalls: Context-Aware Constants`, scale `variable`: the renewal limit is the bare value 2.
5. `.claude/rules/conventions/java.md:15` or `:17`, `project java.md §2` and `code-style methods.md §2`, both named, under `## Docs and configuration`, scale `method`: the project rule splits a method by its count of lines, which the book direction forbids.
6. `lending-app/README.md`, any line, `code-style docs.md §1`, scale `module`: a README inside the folder of an application.

## Allowed

- `LoanRenewalService:20`, `project loans.md §2`, scale `variable` or `class`: the constant of the renewal fee is a bare decimal too.
- `LoanRenewalService#renewLoan:38`, `code-style java.md §1`, scale `method`: the service builds the renewed loan again from the fields of the old loan, work the limits of the rule give to the record.
- `RenewalReceipt:6`, `code-style classes.md §5` or `code-style naming.md §2`, scale `variable`: the component `renewalFee` repeats the word Renewal of the type around it.

## Must not appear

- Any finding on `LoanRepository:12` or on `LoanRenewalService:31` that names `code-style java.md §2`: `project java.md §1` allows Optional and wins over the rule of the skill.
- Any finding on `LoanRenewalService#renewLoan` that names `project java.md §2`: the contradiction is reported on the convention file, never on the code.
- Any finding on `LoanService:9`, the wildcard import: the line is not changed.
- Any finding on a line the change does not add or change.
- Any finding on `Loan.java`: the changed record is clean.
- Any finding that names a book direction that is not marked narrower than the book, such as `code-style naming.md §1` or `code-style methods.md §1`, on code.
- Any finding whose first line does not end in ` · ` and 1 of the words application, module, class, method or variable.
- With the argument `change scales: module,class`, any finding of scale `application`, `method` or `variable`.
