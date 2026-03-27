// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCCIONES DE CONFIGURACIÓN:
// 1. Ve a https://console.firebase.google.com
// 2. Crea un proyecto nuevo (ej: "finanzaspro")
// 3. Activa Authentication → Sign-in method → Email/Password
// 4. Crea Firestore Database (modo producción)
// 5. En Project Settings → General → Your apps → Add app (Web)
// 6. Copia los valores de firebaseConfig y pégalos aquí abajo
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "PEGA_AQUI_TU_API_KEY",
  authDomain:        "PEGA_AQUI_TU_AUTH_DOMAIN",
  projectId:         "PEGA_AQUI_TU_PROJECT_ID",
  storageBucket:     "PEGA_AQUI_TU_STORAGE_BUCKET",
  messagingSenderId: "PEGA_AQUI_TU_MESSAGING_SENDER_ID",
  appId:             "PEGA_AQUI_TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
