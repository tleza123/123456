import 'server-only';
import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;

export function getAdminApp(): admin.app.App {
  if (adminApp) return adminApp;

  if (admin.apps.length > 0 && admin.apps[0]) {
    adminApp = admin.apps[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Replace escaped newlines if passed in environment variable
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const bucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (projectId && clientEmail && privateKey) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      }),
      storageBucket: bucket
    });
  } else {
    // Fallback to application default credentials (ADC) or emulator
    adminApp = admin.initializeApp({
      projectId: projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: bucket
    });
  }

  return adminApp;
}

export function getAdminAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

export function getAdminFirestore(): admin.firestore.Firestore {
  const db = getAdminApp().firestore();
  // Ignore undefined properties to avoid Firestore errors
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export function getAdminStorage(): admin.storage.Storage {
  return getAdminApp().storage();
}
