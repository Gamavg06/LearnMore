// 1. Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDMa5U4uNkiIk4oney9dJhLAn_8dxZd8rM",
  authDomain: "learnmore-3513b.firebaseapp.com",
  projectId: "learnmore-3513b",
  storageBucket: "learnmore-3513b.firebasestorage.app",
  messagingSenderId: "374897084839",
  appId: "1:374897084839:web:af482d357f846c295ace82",
  measurementId: "G-TTJP3TYVH4"
};

// 2. Validación para saber si las credenciales son válidas (evita textos de ejemplo como "TU_API_KEY")
export const firebaseReady = !Object.values(firebaseConfig).some((value) => String(value).startsWith("TU_"));

// 3. Declaración de variables y funciones que exportarás
export let auth = null;
export let db = null;
export let storage = null;
export let analytics = null;

// Funciones marcadas como no disponibles por defecto
export let onAuthStateChanged = unavailable;
export let signInWithEmailAndPassword = unavailable;
export let createUserWithEmailAndPassword = unavailable;
export let sendPasswordResetEmail = unavailable;
export let signOut = unavailable;
export let deleteAuthUser = unavailable;
export let collection = unavailable;
export let doc = unavailable;
export let addDoc = unavailable;
export let setDoc = unavailable;
export let deleteDoc = unavailable;
export let getDoc = unavailable;
export let onSnapshot = unavailable;
export let serverTimestamp = () => new Date();
export let ref = unavailable;
export let uploadBytes = unavailable;
export let getDownloadURL = unavailable;

// 4. Carga dinámica de los SDKs de Firebase desde la CDN oficial
if (firebaseReady) {
  const [appModule, analyticsModule, authModule, firestoreModule, storageModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js"),
  ]);

  // Inicialización de servicios
  const app = appModule.initializeApp(firebaseConfig);
  analytics = analyticsModule.getAnalytics(app);
  auth = authModule.getAuth(app);
  db = firestoreModule.getFirestore(app);
  storage = storageModule.getStorage(app);

  // Asignación de funciones de autenticación
  onAuthStateChanged = authModule.onAuthStateChanged;
  signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
  createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
  sendPasswordResetEmail = authModule.sendPasswordResetEmail;
  signOut = authModule.signOut;
  deleteAuthUser = authModule.deleteUser;

  // Asignación de funciones de Firestore
  collection = firestoreModule.collection;
  doc = firestoreModule.doc;
  addDoc = firestoreModule.addDoc;
  setDoc = firestoreModule.setDoc;
  deleteDoc = firestoreModule.deleteDoc;
  getDoc = firestoreModule.getDoc;
  onSnapshot = firestoreModule.onSnapshot;
  serverTimestamp = firestoreModule.serverTimestamp;

  // Asignación de funciones de Storage
  ref = storageModule.ref;
  uploadBytes = storageModule.uploadBytes;
  getDownloadURL = storageModule.getDownloadURL;
}

// Función de error si algo falla o falta configurar
function unavailable() {
  throw new Error("Firebase no está configurado. Edita js/firebase.js con las credenciales de tu proyecto.");
}