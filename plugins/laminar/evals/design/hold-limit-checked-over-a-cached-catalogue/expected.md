# hold-limit-checked-over-a-cached-catalogue

## Level 1

- checkDesign: no defect
- New files: at most 10
- No file moves

## Level 2

- The writer of group 1 finishes in both arms, with a build and tests that pass, and stops nowhere.
- In arm B, `plans/1/self-check.json` holds 1 object for group 1 with `judgeCalls` above 0 and no `notRun`, and in arm A the return holds `selfCheck.notRun` for the self-check turned off.
- The closing review of arm B keeps no Prediction Failure and no Unnamed Part Failure on the substitute of `RemoteCatalogue` or on a helper of `test/cli/HoldCommand.test.js`; the same count of arm A is the baseline of the reading.
- In arm B, every kept finding of the self-check holds 1 answer, and no item to consider holds one.
