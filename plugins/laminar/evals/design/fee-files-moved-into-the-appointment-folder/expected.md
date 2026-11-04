# fee-files-moved-into-the-appointment-folder

## Level 1

- checkDesign: no defect
- Model path present: FeeSchedule
- Model path present: VisitFee
- Model path absent: appointment/FeeSchedule
- Model path absent: appointment/VisitFee

## Level 2

- The design model names 1 cause for the finding: `FeeSchedule` and `VisitFee` decide what a visit costs, a part that the folder `appointment` does not name.
- The tree of the model gives `FeeSchedule` and `VisitFee` a folder named for the fee of a visit, or puts them back into `billing/`, and the model still reaches both readers of the fee, `AppointmentBook` and `InvoiceService`.
- A review of the code that the writers write from the model, run with the judge types of `judges.txt`, raises no finding on `appointment/` or on the folder that holds the fee files.
