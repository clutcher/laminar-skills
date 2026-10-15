# lending-rule-and-renewal-code-restated-in-a-new-module

## Simplicity

### Production code

1. Method `ReminderPlanner#reminderDateFor`
   - Incomplete Mental Model
   - Also in `LoanTerms#lendingDays`
2. Method `CatalogReminderMapper#toReminderLoan`
   - Incomplete Mental Model
   - Also in `CatalogLoanMapper#toLoanTerms`

## Must not appear

Method `ReminderPlanner#reminderDateFor`, Incomplete Mental Model, also in `LoanStatistics#wasShortened`
