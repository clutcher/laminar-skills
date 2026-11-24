# Plan: pad the row of a shelf code to 2 digits

The shelf code of a book joins the aisle and the row, such as `B-3`. The library prints the codes on labels that a sorter reads in order, so the row must take 2 digits, such as `B-03`, and `B-10` sorts after `B-09`.

## Changes

1. In `src/shelf/shelfLabels.ts`, `formatShelfCode` pads the row to 2 digits with a leading zero: `B-3` becomes `B-03`, and `B-12` stays `B-12`.
2. Tests: in `src/shelf/shelfLabels.test.ts`, the test of `formatShelfCode` expects `B-03` for row 3, and a new test expects `B-12` for row 12.
