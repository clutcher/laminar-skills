# lending-rule-and-renewal-code-restated-in-a-new-module

## Simplicity

### Production code

1. Method `ReminderPlanner#calculateReminderDate`
   - Incomplete Mental Model
   - Also in `LoanTerms#lendingDays`
2. Method `CatalogReminderMapper#createReminderLoan`
   - Incomplete Mental Model
   - Also in `CatalogLoanMapper#createLoanTerms`

## Must not appear

Method `ReminderPlanner#calculateReminderDate`, Incomplete Mental Model, also in `LoanStatistics#wasShortened`
