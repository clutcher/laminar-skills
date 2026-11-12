# looped-io-through-layers

## Performance

### Production code

1. Method `assignAll` in `LockerAssignmentService`
   - Looped I/O

## Must not appear

Method `countFreeSlotsBySize` in `SlotAvailability`, Looped I/O
Method `countFreeSlotsBySize` in `SlotAvailability`, Repeated Retrieval
Method `overweightParcels` in `ParcelIntake`, Repeated Retrieval
