# Plan: check the referral before a specialist visit is booked

A specialist visit may be booked only while the patient holds an open referral for the specialty of the visit, and the referral covers the day of the visit.

## Changes

1. Add `src/main/java/com/example/clinic/referral/ReferralValidator.java`:

   ```java
   package com.example.clinic.referral;

   import java.time.LocalDate;

   public class ReferralValidator {

       public boolean validate(Referral referral, LocalDate visitDay) {
           return !visitDay.isBefore(referral.issuedOn()) && !visitDay.isAfter(referral.validUntil());
       }
   }
   ```

2. Give `AppointmentBook` the `ReferralRepository` and a `ReferralValidator`. In `AppointmentBook#book`, for a visit of the type `SPECIALIST`, take the specialty as a new parameter, find the open referral with `ReferralRepository#findOpenReferral`, and call `ReferralValidator#validate` with the day of the visit. Where no referral is found or `validate` returns false, throw `ReferralMissingException`.
3. Add `src/main/java/com/example/clinic/appointment/ReferralMissingException.java`, beside `SlotTakenException`.
4. Tests: a booking with a referral that covers the day, a booking with no referral, and a booking on the day after `validUntil`.
