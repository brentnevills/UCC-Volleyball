import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
  setLogLevel,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

export const isFirebaseAvailable = !!firebaseConfig.apiKey;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseAvailable) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);

    // Initialize Firestore with robust fallbacks
    try {
      if (firebaseConfig.firestoreDatabaseId) {
        db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      } else {
        db = getFirestore(app);
      }
    } catch (e1) {
      console.warn("Primary getFirestore with named DB failed, falling back:", e1);
      try {
        db = getFirestore(app);
      } catch (e2) {
        console.warn("Fallback getFirestore failed, attempting initializeFirestore:", e2);
        try {
          db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
        } catch (e3) {
          console.error("All Firestore initializations failed:", e3);
        }
      }
    }
    console.log("Firebase initialized successfully, db ready:", !!db);
  } catch (err) {
    console.error("Firebase Initialization Failed:", err);
  }
}

// Silence internal Firestore SDK retry and backoff log spam
try {
  setLogLevel("silent");
} catch {}

export { app, auth, db };
