Add dispatching of shipments to this warehouse shipment service:

- Other modules of the warehouse need 1 entry point to dispatch a registered shipment by its id. Dispatching a shipment id that is not registered is rejected with a reason the caller can show.
- A dispatched shipment is added to the open carrier batch. A batch holds at most 20 shipments, and its window closes 30 minutes after the batch opens. A batch is sent to the carrier as soon as it is full, or when its window closes even if it is not full. The next dispatched shipment then opens a new batch.
- The caller gets back a dispatch receipt: the shipment id, the id of the batch the shipment joined, and the time the window of that batch closes.
- Expose the entry point to the other modules of the warehouse, and write the tests you consider right.
