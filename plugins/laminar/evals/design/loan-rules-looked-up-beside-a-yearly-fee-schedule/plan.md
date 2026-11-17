# Plan: a loan rule for each kind of item, and a yearly fee schedule

The library lends books, films and reference works, and each kind has its own loan rule. Today every item is lent under 1 standard rule of 21 days. Each item already carries the name of its loan rule, and the type `LoanRule` already holds a name, the loan days and the most renewals.

The head librarian keeps the catalogue of loan rules in the settings of the service. Today it holds 3 rules: `book`, 21 days and 2 renewals; `film`, 7 days and 1 renewal; `reference`, 2 days and no renewal. The service reads the catalogue of loan rules when it starts.

Each year the library staff publish a fee schedule. A fee schedule holds the day from which it is valid and the late fee per day for each loan rule, in cents. A schedule stays valid until the next schedule starts. A late return pays, for each day late, the fee per day of its loan rule in the schedule that is valid on the day of the return.

## Changes

1. `LoanDesk#lend` takes the due date from the loan rule of the item: the day of the loan plus the loan days of the rule. Where the catalogue of loan rules holds no rule of the name that the item carries, the loan fails with `UnknownLoanRuleException`, and nothing is saved.
2. Add the operation that returns an item to `ApiForLending`: it takes the loan id and the day of the return, saves the loan with that day, and answers the late fee in cents: 0 where the item comes back on or before the due date, and otherwise the days late times the fee per day of its loan rule in the fee schedule valid on the day of the return. An unknown loan id fails with `LoanNotFoundException`. Where no schedule is valid on that day, or the valid schedule holds no fee for the rule, the return fails with `FeeScheduleMissingException`, and nothing is saved.
3. Add `ApiForFeeSchedules` with the operation that publishes a fee schedule: it takes the day from which the schedule is valid and the fee per day for each rule name. A second schedule valid from the same day fails with `FeeScheduleAlreadyPublishedException`. The schedules are kept in a new store in memory, beside the other stores.
4. The settings hold the 3 loan rules as `library.loan-rules[0].name=book`, `library.loan-rules[0].loan-days=21`, `library.loan-rules[0].max-renewals=2`, and the same for `film` and `reference`.
5. Tests: a loan of a book, of a film and of a reference work, each with its due date; a loan of an item whose rule name is unknown; a return on the due date, which pays 0; a return 3 days late under the second of 2 published schedules; a return before the first schedule; and a second schedule from the same day.
