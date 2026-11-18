# renewal-asked-by-a-member-at-the-web-entry, fix-from-review

The defects of the planted change. Each item names its scale by its kind word, its check by its lead, and the judge type that raises it, so `grade.mjs` grades the stored input review against them. The stored input review may raise other findings, and this file does not grade them, but every kept finding of the input review on the planted change goes to the fix.

Planted item 5 is out since the rewrite of the renewal task, because the renewal answer holds nothing of the mail, so the planted change holds no field of the mail state. So the entry holds 5 planted faults, and the numbers of the other items stay as they were.

Planted item 2, Class `LoanDesk` Unnamed Part Failure, is out by the author's ruling of 2026-11-19, and the planted code stays as it was. `LoanDesk` exists for the renewal alone, so the mail that its 1 use sends is a part of that use, and the class names no part less by sending it. Only this naming claim falls under the ruling. A finding on the dependency, a vendor postbox client used from a domain class, is not forbidden: where a review raises it under its own check, it goes to the fix with the other kept findings.

## Design

### Production code

1. Method `LoanRenewalRestController#renewLoan`
   - Leaked Details
   - Judge: design-leaked-details

## Simplicity

### Production code

3. Method `LoanDesk#renewLoan`
   - Open Construct Overload
   - Judge: simplicity-method
4. Method `ExtensionPolicy#allowsExtension`
   - Incomplete Mental Model
   - Judge: simplicity-decision
7. Class `RenewalCheck`
   - Prediction Failure
   - Judge: simplicity-class

## Correctness · Detection

### Test code

6. Method `LoanRenewalRestControllerTest#shouldSendTheRenewalMailWhenTheLoanIsRenewed`
   - Test Behavior
   - Judge: correctness-simplicity-test-method

## Level 1

- checkDesign: no defect
- No file moves except: domain/model/RenewalCheck
- Model path absent: domain/model/RenewalCheck

`RenewalCheck` gathers the loan id, the member and the renewal count for 1 piece of work of `LoanDesk`, so it is no domain object, but a support of `LoanDesk`, with `for` naming `LoanDesk`, and it belongs with the service that reads it. The line `Model path absent: domain/model/RenewalCheck` passes where the design nests `RenewalCheck` in `LoanDesk`, moves it beside `LoanDesk` or removes it, because the model then lists no class at that path, or lists the file as removed. It fails a design that keeps `RenewalCheck` in the folder `domain/model`. A design that never names `RenewalCheck` passes it falsely, because the model then lists nothing at that path. The line `No file moves except: domain/model/RenewalCheck` lets the design move `RenewalCheck` beside `LoanDesk`, and fails every other move.
