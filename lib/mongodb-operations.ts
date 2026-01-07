// Mock implementation for getServices (replace with real MongoDB logic)
export const getServices = async (filters) => {
	// Example mock data
	return [
		{
			id: 'service1',
			name: 'Web Design',
			category: 'Design',
			providerId: 'vendor1',
			featured: true,
			locationType: 'remote',
			price: 50000,
			rating: 4.8,
			reviews: 120
		},
		{
			id: 'service2',
			name: 'Logo Creation',
			category: 'Design',
			providerId: 'vendor2',
			featured: false,
			locationType: 'local',
			price: 20000,
			rating: 4.5,
			reviews: 80
		}
	];
};

// FINAL STUB EXPORTS ONLY
export const getProducts = () => { throw new Error("Server-only: getProducts is not available on client."); };
export const createProduct = () => { throw new Error("Server-only: createProduct is not available on client."); };
export const updateProduct = () => { throw new Error("Server-only: updateProduct is not available on client."); };
export const deleteProduct = () => { throw new Error("Server-only: deleteProduct is not available on client."); };
export const getVendors = () => { throw new Error("Server-only: getVendors is not available on client."); };
export const getOrders = () => { throw new Error("Server-only: getOrders is not available on client."); };
export const getUserCart = () => { throw new Error("Server-only: getUserCart is not available on client."); };
export const updateUserProfileInDb = () => { throw new Error("Server-only: updateUserProfileInDb is not available on client."); };
export const deleteStore = () => { throw new Error("Server-only: deleteStore is not available on client."); };
export const deleteProductsByVendor = () => { throw new Error("Server-only: deleteProductsByVendor is not available on client."); };
export const deleteServicesByVendor = () => { throw new Error("Server-only: deleteServicesByVendor is not available on client."); };
export const deleteOrdersByVendor = () => { throw new Error("Server-only: deleteOrdersByVendor is not available on client."); };
export const deleteBookingsByVendor = () => { throw new Error("Server-only: deleteBookingsByVendor is not available on client."); };
export const deleteUserCartItemsByVendor = () => { throw new Error("Server-only: deleteUserCartItemsByVendor is not available on client."); };
export const deleteConversationsByVendor = () => { throw new Error("Server-only: deleteConversationsByVendor is not available on client."); };
export const deleteUser = () => { throw new Error("Server-only: deleteUser is not available on client."); };
export const deleteSessions = () => { throw new Error("Server-only: deleteSessions is not available on client."); };