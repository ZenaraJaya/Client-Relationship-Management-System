import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Ensure we don't re-initialize the app on hot reload in dev
let app;
try {
  if (getApps().length > 0) {
    app = getApp();
  } else if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your-api-key') {
    app = initializeApp(firebaseConfig);
  } else {
    // Fallback for build time
    app = initializeApp({ 
      apiKey: "temporary-build-key",
      projectId: "zenara-crm-build" 
    });
  }
} catch (e) {
  app = getApp();
}

export const firebaseApp = app;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
