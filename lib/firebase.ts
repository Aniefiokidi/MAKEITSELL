// Upload image to Firebase Storage and return URL
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

export const uploadImageToStorage = async (file: File, folder: string = "products") => {
  const storage = getStorageInstance()
  const fileRef = ref(storage, `${folder}/${Date.now()}_${file.name}`)
  await uploadBytes(fileRef, file)
  const url = await getDownloadURL(fileRef)
  return url
}
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAnalytics, type Analytics } from "firebase/analytics"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBAt09PdORZjLTB3ZurIlXdcAiBz7f7dPg",
  authDomain: "gote-ecommerce.firebaseapp.com",
  projectId: "gote-ecommerce",
  storageBucket: "gote-ecommerce.appspot.com",
  messagingSenderId: "835462328325",
  appId: "1:835462328325:web:6f93abbbac027231436c6c",
  measurementId: "G-PKDNXK7HKR"
};

// Initialize Firebase app
let app: FirebaseApp
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null
let storageInstance: FirebaseStorage | null = null
let analyticsInstance: Analytics | null = null

const getFirebaseApp = () => {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return app
}

// Lazy initialization functions
export const getAuthInstance = (): Auth | null => {
  if (typeof window === "undefined") return null

  if (!authInstance) {
    const app = getFirebaseApp()
    authInstance = getAuth(app)
  }
  return authInstance
}

export const getDbInstance = (): Firestore => {
  if (!dbInstance) {
    const app = getFirebaseApp()
    dbInstance = getFirestore(app)
  }
  return dbInstance
}

export const getStorageInstance = (): FirebaseStorage => {
  if (!storageInstance) {
    const app = getFirebaseApp()
    storageInstance = getStorage(app)
  }
  return storageInstance
}

export const getAnalyticsInstance = (): Analytics | null => {
  if (typeof window === "undefined") return null

  if (!analyticsInstance) {
    const app = getFirebaseApp()
    analyticsInstance = getAnalytics(app)
  }
  return analyticsInstance
}

// Export instances for backward compatibility
export const auth = getAuthInstance()
export const db = getDbInstance()
export const storage = getStorageInstance()
export const analytics = getAnalyticsInstance()

export default getFirebaseApp()
