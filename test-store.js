// Deprecated: Firestore test logic removed. File retained for legacy reference only.
// Simple test to add a store to Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyC9rq63GsDb47zyDqZnMeWBab1PSla-CIE",
  authDomain: "branda-e95a1.firebaseapp.com",
  projectId: "branda-e95a1",
  storageBucket: "branda-e95a1.firebasestorage.app",
  messagingSenderId: "322810617501",
  appId: "1:322810617501:web:ec336d26ee17fedb5bfe74"
};

async function testStore() {
  try {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('Adding test store...');
    const testStore = {
      vendorId: "test-vendor-123",
      storeName: "Test Store 123",
      storeDescription: "This is a test store created to verify Firestore integration",
      storeImage: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop",
      category: "electronics",
      rating: 4.5,
      reviewCount: 10,
      isOpen: true,
      deliveryTime: "30-45 min",
      deliveryFee: 500,
      minimumOrder: 2000,
      address: "Test Address, Lagos, Nigeria",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await setDoc(doc(db, "stores", "test-store-123"), testStore);
    console.log('✓ Test store added successfully!');
    
    console.log('Fetching all stores...');
    const querySnapshot = await getDocs(collection(db, "stores"));
    const stores = [];
    querySnapshot.forEach((doc) => {
      stores.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Found ${stores.length} stores in database:`);
    stores.forEach(store => {
      console.log(`- ${store.storeName} (ID: ${store.id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testStore();