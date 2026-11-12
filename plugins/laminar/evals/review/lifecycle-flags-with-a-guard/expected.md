# lifecycle-flags-with-a-guard

## Simplicity

### Production code

1. Method `SeedOrder#shipped`
   - Incomplete Mental Model
   - Also in `ParcelDesk#selectParcelsToPack`
2. Class `SeedOrder`
   - Unnamed Part Failure

## Correctness · Prevention

### Production code

1. Class `SeedOrder`
   - Exclude Illegal States
