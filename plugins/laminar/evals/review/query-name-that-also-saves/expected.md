# query-name-that-also-saves

## Simplicity

### Production code

1. Method `CartPricingService#recalculatePrice`
   - Prediction Failure

## Must not appear

Method `CartPricingService#updateCartEntryPrice`, Prediction Failure
Method `CartPricingService#updateCartEntryPrice`, Protect the State, at most 1 at Low confidence
Method `CartPricingService#calculatePrice`, Prediction Failure
Method `CartPricingService#recalculateCartEntryPrice`, Prediction Failure
