# greenhouse-zones-checked-for-dry-soil-and-dry-air

## Must not appear

Class `WateringRound`, Incomplete Mental Model
Method `WateringRound#waterDryZones`, Incomplete Mental Model
Class `DrySoilMorningNotifier`, Incomplete Mental Model
Method `DrySoilMorningNotifier#addLineWhenDry`, Incomplete Mental Model
Any other finding, except Variable Prediction Failure, because code written with the skill fixes the finding of the task in this way: the decision that soil is dry gets 1 owner that makes it, 1 method named for that decision, which the watering round and the notifier both call, and the limit stands only inside that method, as a bare literal or a private constant, so no second copy of the limit or of the comparison draws Incomplete Mental Model; a public constant that the watering round and the notifier both compare with gives the limit 1 home but leaves the decision in 2 places; that owner is never a class that only holds the shared limit, and the limit never becomes a type of its own, such as a percent type; the limit of the air stays apart in `MistingRound`, as its own private constant or as the bare 30 in the 1 method of `MistingRound` that compares the air, and never shares a constant with the limit of the soil, although both limits are 30 today; and the fix adds no new type to the domain model under `model`. A Variable Prediction Failure is excepted, because a naming finding on a constant that the fix adds is graded by the naming cases, not by this case
