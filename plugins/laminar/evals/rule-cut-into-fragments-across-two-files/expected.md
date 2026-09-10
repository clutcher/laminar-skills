# rule-cut-into-fragments-across-two-files

## Simplicity

### Production code

1. Method `LoanPeriod#resolve`
   - Prediction Failure
2. Method `LoanPeriod#from`
   - Prediction Failure
3. Method `RequestedLoanLength#from`
   - Prediction Failure

## Must not appear

Method `ReturnDesk#openLoanFor`, Over-Extraction
