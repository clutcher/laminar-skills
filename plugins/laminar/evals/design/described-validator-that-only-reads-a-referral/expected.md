# described-validator-that-only-reads-a-referral

## Level 1

- checkDesign: no defect
- Model path absent: ReferralValidator
- New files: at most 2
- No file moves

## Level 2

- The design model answers the class `ReferralValidator` of the described change as a name problem: the method only answers whether a referral covers a visit day and rejects nothing, so the name validator predicts a check that the code does not make.
- The tree of the model gives the answer a name that says what it answers, such as a method of `Referral` that says whether the referral covers a day, and the rejection stays in `AppointmentBook`.
- A review of the code that the writers write from the model, run with the judge types of `judges.txt`, raises no Prediction Failure on the class or the method that answers whether a referral covers a day.
