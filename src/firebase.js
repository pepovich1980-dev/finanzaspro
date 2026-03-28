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
  apiKey:            "AIzaSyBYtVg4KF6Y6siabOM4LZJMepSQ9t0LhBk",
  authDomain:        "finanzaspro-c44d6.firebaseapp.com",
  projectId:         "finanzaspro-c44d6",
  storageBucket:     "finanzaspro-c44d6.firebasestorage.app",
  messagingSenderId: "96424716715",
  appId:             "1:96424716715:web:b86bb2c6aaf17f64c50aee"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
