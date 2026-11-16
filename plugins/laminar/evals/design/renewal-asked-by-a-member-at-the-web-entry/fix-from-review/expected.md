# renewal-asked-by-a-member-at-the-web-entry, fix-from-review

The defects of the planted change. Each item names its scale by its kind word, its check by its lead, and the judge type that raises it, so `grade.mjs` grades the stored input review against them. The stored input review may raise other findings, and this file does not grade them.

## Design

### Production code

1. Method `LoanRenewalController#renewLoan`
   - Leaked Details
   - Judge: design-leaked-details

## Simplicity

### Production code

2. Class `LoanDesk`
   - Unnamed Part Failure
   - Judge: simplicity-class
3. Method `LoanDesk#renewLoan`
   - Open Construct Overload
   - Judge: simplicity-method
4. Method `ExtensionPolicy#allowsExtension`
   - Incomplete Mental Model
   - Judge: simplicity-decision

## Correctness · Prevention

### Production code

5. Class `RenewedLoan`
   - Exclude Illegal States
   - Judge: correctness-prevention

## Correctness · Detection

### Test code

6. Method `LoanRenewalControllerTest#shouldSendTheRenewalMailWhenTheLoanIsRenewed`
   - Test Behavior
   - Judge: correctness-simplicity-test-method

## Level 1

- checkDesign: no defect
- No file moves
