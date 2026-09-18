// Replaces lib/order-notifications.ts in scenario tests: the real one sends email and
// push (SMTP with no server configured hangs for a minute). Calls are recorded instead.
export const notificationCalls = []
export async function sendOrderStatusChangeNotifications(orderId, order, newStatus) { notificationCalls.push({ kind: 'status', orderId, newStatus }) }
export async function sendOrderPlacementNotifications(orderId) { notificationCalls.push({ kind: 'placed', orderId }) }
