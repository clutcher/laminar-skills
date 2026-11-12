# Plan: order a lab panel for a patient

A clinician orders a lab panel for a patient, with the time the sample is taken. Where the clinician gives no sample time, the sample is taken at the time of the order. A panel that needs fasting may be ordered only where the sample is taken at least the fasting hours of the panel after the last meal that the patient reports.

## Changes

1. Add the folder `src/main/java/com/example/clinic/laborder/` with the enum `LabPanel`, whose values `BLOOD_COUNT`, `GLUCOSE` and `LIPID_PROFILE` hold their fasting hours, 0, 8 and 12; the record `LabOrder` with the order id, the patient id, the panel, the sample time, the time of the order and the id of the clinician who ordered it; the interface `LabOrderRepository` with `save(LabOrder)`; and the service `LabOrderDesk` with the method that orders a panel.
2. Add `src/main/java/com/example/clinic/laborder/FastingValidator.java`, by the rule of the project on lab orders:

   ```java
   package com.example.clinic.laborder;

   import java.time.Duration;
   import java.time.LocalDateTime;

   public class FastingValidator {

       public LabOrder validate(LabOrder order, LocalDateTime lastMealAt) {
           LabOrder sampledOrder = order;
           if (order.sampleAt() == null) {
               sampledOrder = new LabOrder(order.orderId(), order.patientId(), order.panel(), order.orderedAt(), order.orderedAt(), order.orderedBy());
           }
           if (Duration.between(lastMealAt, sampledOrder.sampleAt()).toHours() < sampledOrder.panel().fastingHours()) {
               throw new FastingTooShortException();
           }

           return sampledOrder;
       }
   }
   ```

   The order method of `LabOrderDesk` sets the time of the order, calls it and saves the order that it returns.
3. Add `POST /patients/{patientId}/lab-orders` in a new controller under `src/main/java/com/example/clinic/laborder/web/`. The body of the call holds the panel, the sample time, which the clinician may leave out, the time of the last meal and the id of the clinician; the answer holds the order id, the panel and the sample time, with the status 201. A `FastingTooShortException` answers 422.
4. Tests: an order of a panel that needs no fasting, an order with enough fasting, an order with too little fasting, which answers 422, and an order with no sample time, whose answer holds the time of the order as the sample time.
