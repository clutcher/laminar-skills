# split-class-moves-a-method-of-another-purpose

## Simplicity

### Production code

1. Class `LoanChargeCalculator`
   - Unnamed Part Failure
2. Module `lending/src/main/java/com/example/lending/desk`
   - Unnamed Part Failure

## Must not appear

Method `LoanService#lendCopy`, Prediction Failure
Method `LoanService#lendCopy`, Unnamed Part Failure
Method `LoanService#returnCopy`, Prediction Failure
Method `LoanService#returnCopy`, Unnamed Part Failure
Method `LoanService#renewLoan`, Prediction Failure
Method `LoanService#renewLoan`, Unnamed Part Failure
Method `LoanService#countOpenLoansOf`, Prediction Failure
Method `LoanService#countOpenLoansOf`, Unnamed Part Failure
Method `LoanService#readDueDate`, Prediction Failure
Method `LoanService#readDueDate`, Unnamed Part Failure
Method `LoanService#listOverdueLoans`, Prediction Failure
Method `LoanService#listOverdueLoans`, Unnamed Part Failure
Method `LoanChargeCalculator#sendOverdueReminder`, Prediction Failure
Method `LoanChargeCalculator#sendOverdueReminder`, Unnamed Part Failure
