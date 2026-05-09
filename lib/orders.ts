export const orderStatuses = [
  "new_intent",
  "contacted",
  "confirmed",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (orderStatuses as readonly string[]).includes(value);
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "new_intent":
      return "New intent";
    case "contacted":
      return "Contacted";
    case "confirmed":
      return "Confirmed";
    case "dispatched":
      return "Dispatched";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
