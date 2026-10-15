# chained-steps-hold-unnamed-parts

## Simplicity

### Production code

1. Method `BoxOfficeService#createTickets`
   - Unnamed Part Failure
2. Method `BoxOfficeService#getReservationsToRelease`
   - Unnamed Part Failure
3. Method `BoxOfficeService#createSeatLabelsForPaidReservations`
   - Unnamed Part Failure
4. Method `BoxOfficeService#getPricesToCharge`
   - Unnamed Part Failure
5. Method `BoxOfficeService#getUnpaidReservations`
   - Prediction Failure

## Must not appear

Method `BoxOfficeService#createSeatLabelsForPaidReservations`, Open Construct Overload
