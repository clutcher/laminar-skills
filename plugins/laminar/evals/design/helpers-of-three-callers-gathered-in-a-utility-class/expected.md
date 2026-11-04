# helpers-of-three-callers-gathered-in-a-utility-class

## Level 1

- checkDesign: no defect
- Model path absent: ClinicUtils
- Model path absent: clinic/util
- New files: at most 3

## Level 2

- The design model names 1 cause for the 2 findings: the 6 helpers of `ClinicUtils` serve 3 callers with 3 different subjects, so the folder `util` and the class name no part.
- The tree of the model groups the 6 helpers by their callers: the slot rules with booking, the patient share and the rounding with the invoice, and the send time and the phone form with the reminder, as private methods of each caller or as at most 1 new file in the folder of each caller; no new file holds 1 helper alone, and no folder or class of the model has a general name, such as util, helper or common.
- A review of the code that the writers write from the model, run with the judge types of `judges.txt`, raises no Prediction Failure or Unnamed Part Failure on a folder or a class that the model created.
