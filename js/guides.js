import {
  firebaseReady,
  db,
  storage,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
} from "./firebase.js";

const KEYS = {
  guides: "sgnia.guides",
  careers: "sgnia.careers",
  messages: "sgnia.messages",
  users: "sgnia.users",
  activity: "sgnia.activity",
};

export const defaultCareers = [
  { id: "mec", key: "mec", name: "Ingenieria en Mecatronica", desc: "Robotica, control, electronica y sistemas embebidos.", color: "#00d4ff" },
  { id: "ti", key: "ti", name: "TI e Innovacion Digital", desc: "Software, nube, datos, ciberseguridad e inteligencia artificial.", color: "#7c3aed" },
  { id: "proc", key: "proc", name: "Procesos Industriales", desc: "Manufactura, calidad, automatizacion, logistica y mejora continua.", color: "#10b981" },
];

export const defaultGuides = [
  {
    id: "g-control",
    title: "Sistemas de Control Clasico",
    desc: "Funciones de transferencia, estabilidad, Bode, Nyquist y controladores PID.",
    detail: "Guia para analizar y disenar sistemas de control retroalimentados aplicados a procesos industriales y roboticos.",
    career: "mec",
    sem: 3,
    topics: ["Funcion de transferencia", "Bode", "PID", "Estabilidad"],
    fileUrl: "",
  },
  {
    id: "g-robotica",
    title: "Robotica Industrial",
    desc: "Cinematica directa e inversa, matrices homogeneas, Jacobianos y trayectorias.",
    detail: "Material practico para modelar manipuladores industriales y simular movimientos seguros.",
    career: "mec",
    sem: 4,
    topics: ["Denavit-Hartenberg", "Jacobianos", "ROS", "Trayectorias"],
    fileUrl: "",
  },
  {
    id: "g-python",
    title: "Fundamentos de Programacion con Python",
    desc: "Estructuras de datos, POO, modulos, excepciones, testing y algoritmos.",
    detail: "Ruta introductoria para construir programas mantenibles con Python y buenas practicas.",
    career: "ti",
    sem: 2,
    topics: ["POO", "Listas", "pytest", "Algoritmos"],
    fileUrl: "",
  },
  {
    id: "g-datos",
    title: "Bases de Datos SQL y NoSQL",
    desc: "Modelo relacional, SQL avanzado, normalizacion, MongoDB y optimizacion.",
    detail: "Guia completa para disenar esquemas, consultar datos y elegir tecnologias segun el problema.",
    career: "ti",
    sem: 4,
    topics: ["SQL", "Normalizacion", "MongoDB", "Indices"],
    fileUrl: "",
  },
  {
    id: "g-manufactura",
    title: "Fundamentos de Manufactura",
    desc: "Maquinado, fundicion, conformado, soldadura, metrologia y control dimensional.",
    detail: "Material para seleccionar procesos de manufactura y controlar parametros de calidad.",
    career: "proc",
    sem: 2,
    topics: ["CNC", "Soldadura", "Metrologia", "Calidad"],
    fileUrl: "",
  },
  {
    id: "g-lean",
    title: "Lean Manufacturing y Six Sigma",
    desc: "VSM, 5S, Kaizen, DMAIC, SPC, AMEF e indicadores de mejora.",
    detail: "Guia enfocada en reducir desperdicio, controlar variacion y mejorar procesos industriales.",
    career: "proc",
    sem: 3,
    topics: ["DMAIC", "5S", "SPC", "AMEF"],
    fileUrl: "",
  },
];

function read(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("sgnia:local-change", { detail: { key } }));
}

export function ensureLocalSeed() {
  if (!localStorage.getItem(KEYS.careers)) write(KEYS.careers, defaultCareers);
  if (!localStorage.getItem(KEYS.guides)) write(KEYS.guides, defaultGuides);
  if (!localStorage.getItem(KEYS.messages)) write(KEYS.messages, []);
  if (!localStorage.getItem(KEYS.users)) write(KEYS.users, []);
  if (!localStorage.getItem(KEYS.activity)) write(KEYS.activity, []);
}

function localSubscribe(key, fallback, callback) {
  ensureLocalSeed();
  callback(read(key, fallback));
  const handler = (event) => {
    if (!event.detail || event.detail.key === key) callback(read(key, fallback));
  };
  window.addEventListener("sgnia:local-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("sgnia:local-change", handler);
    window.removeEventListener("storage", handler);
  };
}

function subscribeCollection(name, fallback, callback) {
  if (!firebaseReady) return localSubscribe(KEYS[name], fallback, callback);
  return onSnapshot(collection(db, name), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  });
}

export const subscribeGuides = (callback) => subscribeCollection("guides", defaultGuides, callback);
export const subscribeCareers = (callback) => subscribeCollection("careers", defaultCareers, callback);
export const subscribeMessages = (callback) => subscribeCollection("messages", [], callback);
export const subscribeUsers = (callback) => subscribeCollection("users", [], callback);
export const subscribeActivity = (callback) => subscribeCollection("activity", [], callback);

function localUpsert(key, data) {
  const list = read(key, []);
  const id = data.id || `${Date.now()}`;
  const next = [{ ...data, id, updatedAt: new Date().toISOString() }, ...list.filter((item) => item.id !== id)];
  write(key, next);
  return id;
}

function localDelete(key, id) {
  write(key, read(key, []).filter((item) => item.id !== id));
}

export async function saveGuide(data) {
  const payload = { ...data, sem: Number(data.sem), topics: normalizeTopics(data.topics) };
  if (!firebaseReady) {
    const id = localUpsert(KEYS.guides, payload);
    addActivity({ type: "guide", text: `Guia guardada: ${payload.title}` });
    return id;
  }
  if (payload.file) {
    const path = `guides/${Date.now()}-${payload.file.name}`;
    const uploaded = await uploadBytes(ref(storage, path), payload.file);
    payload.fileUrl = await getDownloadURL(uploaded.ref);
  }
  delete payload.file;
  const id = payload.id;
  delete payload.id;
  if (id) await setDoc(doc(db, "guides", id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  else await addDoc(collection(db, "guides"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await addDoc(collection(db, "activity"), { type: "guide", text: `Guia guardada: ${payload.title}`, createdAt: serverTimestamp() });
}

export async function deleteGuide(id) {
  if (!firebaseReady) return localDelete(KEYS.guides, id);
  return deleteDoc(doc(db, "guides", id));
}

export async function saveCareer(data) {
  const payload = { ...data, key: data.key.trim().toLowerCase() };
  if (!firebaseReady) return localUpsert(KEYS.careers, { ...payload, id: payload.id || payload.key });
  const id = payload.id || payload.key;
  delete payload.id;
  return setDoc(doc(db, "careers", id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteCareer(id) {
  if (!firebaseReady) return localDelete(KEYS.careers, id);
  return deleteDoc(doc(db, "careers", id));
}

export async function saveMessage(data) {
  const payload = { ...data, status: "nuevo", createdAt: new Date().toISOString() };
  if (!firebaseReady) return localUpsert(KEYS.messages, payload);
  return addDoc(collection(db, "messages"), { ...data, status: "nuevo", createdAt: serverTimestamp() });
}

export async function updateMessageStatus(id, status) {
  if (!firebaseReady) {
    const list = read(KEYS.messages, []).map((item) => item.id === id ? { ...item, status } : item);
    return write(KEYS.messages, list);
  }
  return setDoc(doc(db, "messages", id), { status, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveUser(data) {
  const payload = {
    ...data,
    role: data.role || "user",
    email: String(data.email || "").trim().toLowerCase(),
  };
  const id = payload.id || payload.email;

  if (!firebaseReady) {
    const existing = read(KEYS.users, []).find((item) => item.id === id);
    const saved = { ...payload, id };
    if (!saved.password && existing?.password) saved.password = existing.password;
    if (!saved.password) delete saved.password;
    const result = localUpsert(KEYS.users, saved);
    addActivity({ type: "user", text: `Usuario guardado: ${payload.email}` });
    return result;
  }

  delete payload.id;
  delete payload.password;
  delete payload.photoFile;
  await setDoc(doc(db, "users", id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  await addDoc(collection(db, "activity"), { type: "user", text: `Usuario guardado: ${payload.email}`, createdAt: serverTimestamp() });
  return id;
}

export async function deleteUser(id) {
  if (!firebaseReady) return localDelete(KEYS.users, id);
  return deleteDoc(doc(db, "users", id));
}

export function saveLocalUser(user) {
  if (firebaseReady) return;
  localUpsert(KEYS.users, { ...user, role: user.role || "user" });
}

export function localUsers() {
  ensureLocalSeed();
  return read(KEYS.users, []);
}

export function getLocalSession() {
  try {
    return JSON.parse(sessionStorage.getItem("sgnia.session"));
  } catch {
    return null;
  }
}

export function setLocalSession(session) {
  sessionStorage.setItem("sgnia.session", JSON.stringify(session));
}

export function clearLocalSession() {
  sessionStorage.removeItem("sgnia.session");
}

export function getLocalCurrentUser() {
  const session = getLocalSession();
  if (!session?.email) return null;
  return localUsers().find((user) => user.email === session.email) || session;
}

export function addActivity(activity) {
  if (firebaseReady) return;
  localUpsert(KEYS.activity, { ...activity, createdAt: new Date().toISOString() });
}

export function normalizeTopics(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}
