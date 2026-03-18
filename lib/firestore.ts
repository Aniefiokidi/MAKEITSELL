
// Compatibility shim for legacy imports while the app is migrated to MongoDB.

export interface SupportTicket {
	id?: string
	customerId?: string
	customerName?: string
	vendorId?: string
	vendorName?: string
	subject?: string
	message?: string
	status?: "open" | "in-progress" | "resolved" | "closed"
	priority?: "low" | "medium" | "high" | "urgent"
	messages?: Array<{
		senderId: string
		senderRole: "customer" | "vendor" | "admin" | "ai"
		message: string
		timestamp: any
	}>
	updatedAt?: any
	[key: string]: any
}

export async function getSupportTickets(): Promise<SupportTicket[]> {
	// No Firestore source remains in this workspace. Return empty list to keep screens stable.
	return []
}

export async function updateSupportTicket(_ticketId: string, _ticketData: Partial<SupportTicket>): Promise<boolean> {
	// Legacy no-op shim until support ticket writes are fully migrated.
	return true
}




