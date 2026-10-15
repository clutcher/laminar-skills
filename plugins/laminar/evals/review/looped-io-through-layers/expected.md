# looped-io-through-layers

## Performance

### Production code

1. Method `assignAll` in `LockerAssignmentService`
   - Looped I/O

## Must not appear

Method `freeSlotsBySize` in `SlotAvailability`, Looped I/O
Method `overweightParcels` in `ParcelIntake`, Looped I/O
Method `freeSlotsBySize` in `SlotAvailability`, Repeated Retrieval
Method `overweightParcels` in `ParcelIntake`, Repeated Retrieval
