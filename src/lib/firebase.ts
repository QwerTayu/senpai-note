import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let db: Firestore | null = null;

export function firestore(): Firestore {
  if (db) return db;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 が設定されていません");
  const serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore(app);
  return db;
}
