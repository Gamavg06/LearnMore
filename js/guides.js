// js/guides.js — solo importar supabase, nada más
import { supabase } from './supabase.js';

// También necesitas esta variable que uses en el código pero no está definida localmente:
export const supabaseReady = !!supabase;
// Si Supabase no está listo, usaremos localStorage como respaldo
// (Manteniendo la misma lógica que antes para el modo local)

const KEYS = {
  guides: "learnmore.guides",
  careers: "learnmore.careers",
  messages: "learnmore.messages",
  users: "learnmore.users",
  activity: "learnmore.activity",
  reviews: "learnmore.reviews",
};

export const defaultCareers = [
  {
    id: "01",            // 👈 Cambiado de "mecatronica" a "01"
    key: "01",
    name: "Mecatrónica",
    desc: "Carrera de Mecatrónica",
    color: "#00d4ff"
  },
  {
    id: "02",            // 👈 Cambiado de "ti" a "02"
    key: "02",
    name: "TI e Innovación Digital",
    desc: "Carrera de Tecnologías de la Información e Innovación Digital",
    color: "#7c3aed"
  },
  {
    id: "03",            // 👈 Cambiado de "procesos" a "03"
    key: "03",
    name: "Procesos Industriales",
    desc: "Carrera de Procesos Industriales",
    color: "#10b981"
  }
];
export const defaultGuides = [];

// Funciones para modo local (idénticas a las originales)
function readLocal(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("learnmore:local-change", { detail: { key } }));
}

export function ensureLocalSeed() {
  if (!localStorage.getItem(KEYS.careers)) writeLocal(KEYS.careers, defaultCareers);
  if (!localStorage.getItem(KEYS.guides)) writeLocal(KEYS.guides, defaultGuides);
  if (!localStorage.getItem(KEYS.messages)) writeLocal(KEYS.messages, []);
  if (!localStorage.getItem(KEYS.users)) writeLocal(KEYS.users, []);
  if (!localStorage.getItem(KEYS.activity)) writeLocal(KEYS.activity, []);
}

function localSubscribe(key, fallback, callback) {
   ensureLocalSeed();
   const data = readLocal(key, fallback);
   console.log('[guides] localSubscribe', key, 'data:', data);
   callback(data);
   const handler = (event) => {
     if (!event.detail || event.detail.key === key) callback(readLocal(key, fallback));
   };
   window.addEventListener("learnmore:local-change", handler);
   window.addEventListener("storage", handler);
   return () => {
    window.removeEventListener("learnmore:local-change", handler);
    window.removeEventListener("storage", handler);
  };
}

// Funciones para modo Supabase
async function subscribeSupabaseTable(tableName, fallback, callback) {
  if (!supabaseReady) {
    return localSubscribe(KEYS[tableName], fallback, callback);
  }

  // ── FIX: tablas opcionales que pueden no existir aún ──────────────────────
  const optionalTables = ["gmailMessages", "reviews"];
  const tablesWithCreatedAt = ["messages", "users", "activity", "reviews", "gmailMessages"];
  const orderByColumn = tablesWithCreatedAt.includes(tableName) ? 'created_at' : 'id';
  
  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order(orderByColumn, { ascending: false });

      if (error) {
        if (optionalTables.includes(tableName)) {
          callback(fallback);
        } else {
          console.error(`Error fetching ${tableName}:`, error);
        }
        return false;
      }
      callback(data?.length ? data : fallback);
      return true;
    } catch (e) {
      if (optionalTables.includes(tableName)) {
        callback(fallback);
      } else {
        console.error(`Exception fetching ${tableName}:`, e);
      }
      return false;
    }
  };

  // Carga inicial
  await fetchData();

  // Polling fallback de 8 segundos si no hay replicación en tiempo real habilitada
  const intervalId = setInterval(fetchData, 8000);

  // Configurar suscripción en tiempo real
  const channel = supabase
    .channel(`public:${tableName}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
      fetchData();
    })
    .subscribe();

  return () => {
    clearInterval(intervalId);
    supabase.removeChannel(channel);
  };
}

function localUpsert(key, data) {
  const list = readLocal(key, []);
  const id = data.id || `${Date.now()}`;
  const next = [{ ...data, id, updatedAt: new Date().toISOString() }, ...list.filter((item) => item.id !== id)];
  writeLocal(key, next);
  return id;
}

function localDelete(key, id) {
  writeLocal(key, readLocal(key, []).filter((item) => item.id !== id));
}

// ==========================================
// FUNCIÓN DE NORMALIZACIÓN
// ==========================================
export function normalizeTopics(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

// ==========================================
// FUNCIONES DE SUPABASE PARA COLECCIONES
// ==========================================

export function collection(tableName) {
  if (!supabaseReady) throw new Error("Supabase no está listo");
  return supabase.from(tableName);
}

export function doc(tableName, id) {
  if (!supabaseReady) throw new Error("Supabase no está listo");
  return supabase.from(tableName).eq('id', id);
}

export async function addDoc(tableReference, data) {
  if (!supabaseReady) throw new Error("Supabase no está listo");
  const { data: result, error } = await supabase
    .from(tableReference)
    .insert({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function setDoc(docReference, data, options = {}) {
  if (!supabaseReady) throw new Error("Supabase no está listo");
  throw new Error("setDoc no implementado. Use funciones específicas (saveGuide, saveUser, etc.).");
}

export async function deleteDoc(docReference) {
  if (!supabaseReady) throw new Error("Supabase no está listo");
  throw new Error("deleteDoc no implementado. Use funciones específicas (deleteGuide, deleteUser, etc.).");
}

export async function getDoc(docReference) {
  if (!supabaseReady) throw new Error("Supabase no está listo");
  throw new Error("getDoc no implementado. Use funciones específicas.");
}

export function onSnapshot(tableReference, callback) {
  if (!supabaseReady) {
    return localSubscribe("temp", [], callback);
  }
  return subscribeSupabaseTable("temp", [], callback);
}

export function serverTimestamp() {
  return new Date();
}

export function ref(storageInstance, path) {
  if (!supabaseReady) throw new Error("Supabase no está listo");

  return {
    path
  };
}
export async function uploadBytes(fileRef, file) {
  if (!supabaseReady) throw new Error("Supabase no está listo");

  const bucket = "guides"; // <-- cambia esto si tu bucket tiene otro nombre

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileRef.path, file, {
      upsert: true
    });

  if (error) {
    console.error("UPLOAD ERROR:", error);
    throw error;
  }

  return data;
}

export async function getDownloadURL(fileRef) {
  if (!supabaseReady) throw new Error("Supabase no está listo");

  const bucket = "guides"; // <-- mismo nombre del bucket

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileRef.path);

  return data.publicUrl;
}
// ==========================================
// FUNCIONES ESPECÍFICAS PARA CADA COLECCIÓN
// ==========================================

export const subscribeGuides        = (callback) => subscribeSupabaseTable("guides",        defaultGuides,  callback);
export const subscribeCareers       = (callback) => subscribeSupabaseTable("careers",       defaultCareers, callback);
export const subscribeMessages      = (callback) => subscribeSupabaseTable("messages",      [],             callback);
export const subscribeGmailMessages = (callback) => subscribeSupabaseTable("gmailMessages", [],             callback);
export const subscribeUsers         = (callback) => subscribeSupabaseTable("users",         [],             callback);
export const subscribeActivity      = (callback) => subscribeSupabaseTable("activity",      [],             callback);
export const subscribeReviews       = (callback) => subscribeSupabaseTable("reviews",       [],             callback);

// Funciones de guardado específicas
export async function saveGuide(data) {
  const payload = {
    ...data,
    sem: Number(data.sem || 1),
    topics: normalizeTopics(data.topics)
  };

  if (!supabaseReady) {
    const id = localUpsert(KEYS.guides, payload);
    addActivity({ type: "guide", text: `Guia guardada: ${payload.title}` });
    return id;
  }

if (payload.file && payload.file instanceof File) {

  const filePath =
    `${Date.now()}-${payload.file.name.replace(/\s+/g, "_")}`;

  const uploaded = await uploadBytes(
    ref(supabase.storage, filePath),
    payload.file
  );

  payload.fileUrl = await getDownloadURL({
    path: uploaded.path
  });
}
  delete payload.file;
  const id = payload.id;
  delete payload.id;

  const timestamp = new Date().toISOString();
  const dataToSave = {
    ...payload,
    updated_at: timestamp,
    ...(id ? {} : { created_at: timestamp })
  };

  try {
    if (id) {
      const { error } = await supabase.from("guides").update(dataToSave).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("guides").insert(dataToSave).select().single();
      if (error) throw error;
    }

    await saveActivity({ type: "guide", text: `Guia guardada: ${payload.title || "(Sin título)"}` });
    return id || Date.now();
  } catch (error) {
    console.error("Error saving guide:", error);
    throw error;
  }
}
export async function saveCareer(data) {
  // 1. Extraemos el identificador de texto limpio (ej: "01", "02", "ti") desde el formulario
  const careerId = String(data.key || data.id || "").trim().toLowerCase();

  const payload = {
    id: careerId, // Asignamos la clave directamente al campo obligatorio ID de la BD
    name: data.name || "",
    description: data.description || data.desc || "", // Mapeamos ambas variantes de descripción
    color: data.color || "#00d4ff",
  };

  // Respaldo en LocalStorage si Supabase está caído o desconectado
  if (!supabaseReady) {
    return localUpsert(KEYS.careers, payload);
  }

  const timestamp = new Date().toISOString();

  try {
    // 2. Consultamos directamente si ya existe este ID manual en Supabase
    const { data: existing, error: selectError } = await supabase
      .from("careers")
      .select("id")
      .eq("id", careerId)
      .maybeSingle(); // Evita lanzar excepciones si no encuentra nada

    if (selectError) throw selectError;

    if (existing) {
      // 3. Si ya existe, actualizamos los campos dinámicos usando su ID como referencia
      const { error } = await supabase
        .from("careers")
        .update({
          name: payload.name,
          description: payload.description,
          color: payload.color
        })
        .eq("id", careerId);
      if (error) throw error;
    } else {
      // 4. Si es nuevo, insertamos el registro inyectando manualmente nuestro ID de texto
      const { error } = await supabase
        .from("careers")
        .insert({
          id: payload.id,
          name: payload.name,
          description: payload.description,
          color: payload.color,
          created_at: timestamp,
        });
      if (error) throw error;
    }
    return careerId;
  } catch (error) {
    console.error("Error saving career:", error);
    throw error;
  }
}
export async function saveMessage(data) {
  const isEdit = !!data.id;
  const payload = { ...data };
  if (!isEdit) {
    payload.status = "nuevo";
    payload.created_at = new Date().toISOString();
  } else {
    payload.updated_at = new Date().toISOString();
  }

  if (!supabaseReady) {
    return localUpsert(KEYS.messages, payload);
  }

  try {
    if (isEdit) {
      const id = payload.id;
      delete payload.id;
      const { error } = await supabase.from("messages").update(payload).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      const { data: result, error } = await supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const fnUrl = (window.__LEARNMORE_SEND_CONTACT_EMAIL_URL__ || "");
      if (fnUrl) {
        try {
          await fetch(fnUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              email: payload.email,
              subject: payload.subject,
              message: payload.message,
            }),
          });
        } catch (e) {
          console.warn("No se pudo enviar email al admin:", e);
        }
      } else {
        console.warn("Falta configurar window.__LEARNMORE_SEND_CONTACT_EMAIL_URL__");
      }

      return result.id;
    }
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
}

export async function updateMessageStatus(id, status) {
  if (!supabaseReady) {
    const list = readLocal(KEYS.messages, []).map((item) =>
      item.id === id ? { ...item, status } : item
    );
    return writeLocal(KEYS.messages, list);
  }

  try {
    const { error } = await supabase
      .from("messages")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return id;
  } catch (error) {
    console.error("Error updating message status:", error);
    throw error;
  }
}

export async function replyToMessage(id, reply, adminName) {
  if (!supabaseReady) {
    const list = readLocal(KEYS.messages, []).map((item) =>
      item.id === id ? { ...item, reply, replied_at: new Date().toISOString(), replied_by: adminName, status: "respondido" } : item
    );
    return writeLocal(KEYS.messages, list);
  }

  const previous = await supabase.from('messages').select('*').eq('id', id).single();
  const messageData = previous.data;

  try {
    const { error } = await supabase
      .from("messages")
      .update({
        reply,
        replied_at: new Date().toISOString(),
        replied_by: adminName,
        status: "respondido",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
      
    if (error) {
      // Check if the error is due to missing columns in schema cache
      if (error.message && (error.message.includes("column") || error.code === "PGRST204" || error.message.includes("schema cache"))) {
        console.warn("replied_at/replied_by columns missing in messages table, retrying update without them...");
        const { error: retryError } = await supabase
          .from("messages")
          .update({
            reply,
            status: "respondido",
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
    return id;
  } catch (error) {
    console.error("Error replying to message:", error);
    throw error;
  } finally {
    const contactEmail = messageData?.email || '';
    const contactSubject = messageData?.subject || '';
    const contactMessage = messageData?.message || '';
    if (!contactEmail) return;

    const fnUrl = window.__LEARNMORE_SEND_REPLY_EMAIL_URL__ || '';
    if (!fnUrl) {
      console.warn('Falta configurar window.__LEARNMORE_SEND_REPLY_EMAIL_URL__');
      return;
    }

    try {
      await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage,
          reply,
        }),
      });
    } catch (e) {
      console.warn('No se pudo enviar correo de respuesta:', e);
    }
  }
}

export async function saveUser(data) {
  const payload = {
    ...data,
    role: data.role || "user",
    email: String(data.email || "").trim().toLowerCase(),
  };

  // El id puede venir del objeto o usamos el email como identificador
  const id = payload.id || payload.email;

  // ── FIX: si el id no es un UUID válido (ej. admin@learnmore.local), guardar solo local ──
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  if (!supabaseReady || !isUUID) {
    const existing = readLocal(KEYS.users, []).find((item) => item.id === id);
    const saved = { ...payload, id };
    if (!saved.password && existing?.password) saved.password = existing.password;
    if (!saved.password) delete saved.password;
    const result = localUpsert(KEYS.users, saved);
    addActivity({ type: "user", text: `Usuario guardado: ${payload.email}` });
    return result;
  }

// ── FIX: limpiar campos que no van a la BD (password y photoFile son solo locales) ──
   delete payload.password;
   delete payload.photoFile;

  const timestamp = new Date().toISOString();

  // Construir objeto limpio con id explícito
  const dataToSave = {
    id,                          // ← id siempre presente para el upsert
    ...payload,
    updated_at: timestamp,
    created_at: timestamp,       // Supabase lo ignora si la fila ya existe
  };

  // Asegurarse de que no haya id duplicado dentro del spread
  delete dataToSave.id;          // borramos el que viene del spread de payload
  dataToSave.id = id;            // y lo ponemos una sola vez al final

  try {
    // ── FIX: upsert con onConflict explícito en la columna id ────────────────
    const { error } = await supabase
      .from("users")
      .upsert(dataToSave, { onConflict: "id", ignoreDuplicates: false });

    if (error) throw error;

    await saveActivity({ type: "user", text: `Usuario guardado: ${payload.email}` });
    return id;
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
}

export async function deleteGuide(id) {
  if (!supabaseReady) return localDelete(KEYS.guides, id);

  try {
    const { error } = await supabase.from("guides").delete().eq("id", id);
    if (error) throw error;
    await saveActivity({ type: "guide", text: `Guia eliminada: ${id}` });
    return id;
  } catch (error) {
    console.error("Error deleting guide:", error);
    throw error;
  }
}

export async function deleteCareer(id) {
  // Normalizamos el ID para asegurarnos de que busque "01", "ti", etc., de forma limpia
  const careerId = String(id || "").trim().toLowerCase();

  if (!supabaseReady) {
    return localDelete(KEYS.careers, careerId);
  }

  try {
    const { error } = await supabase
      .from("careers")
      .delete()
      .eq("id", careerId);

    if (error) throw error;
    return careerId;
  } catch (error) {
    console.error("Error deleting career:", error);
    throw error;
  }
}
export async function deleteUser(id) {
  if (!supabaseReady) return localDelete(KEYS.users, id);

  try {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;
    return id;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

export async function saveReview(data) {
  const isEdit = !!data.id;
  const payload = { ...data };
  if (!isEdit) {
    payload.status = data.status || "nuevo";
    payload.created_at = new Date().toISOString();
  }
  payload.updated_at = new Date().toISOString();

  if (!supabaseReady) {
    const id = payload.id || localUpsert(KEYS.reviews, payload);
    addActivity({ type: "review", text: `Reseña guardada: ${payload.name}` });
    return id;
  }

  try {
    if (isEdit) {
      const id = payload.id;
      delete payload.id;
      const { error } = await supabase.from("reviews").update(payload).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      const { data: result, error } = await supabase
        .from("reviews")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await saveActivity({ type: "review", text: `Reseña guardada: ${payload.name}` });
      return result.id;
    }
  } catch (error) {
    console.error("Error saving review:", error);
    throw error;
  }
}

export async function updateReviewStatus(id, status) {
  if (!supabaseReady) {
    const list = readLocal(KEYS.reviews, []).map((item) =>
      item.id === id ? { ...item, status } : item
    );
    return writeLocal(KEYS.reviews, list);
  }

  try {
    const { error } = await supabase
      .from("reviews")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return id;
  } catch (error) {
    console.error("Error updating review status:", error);
    throw error;
  }
}

export async function replyToReview(id, reply, adminName) {
  if (!supabaseReady) {
    const list = readLocal(KEYS.reviews, []).map((item) =>
      item.id === id ? { ...item, reply, replied_at: new Date().toISOString(), replied_by: adminName } : item
    );
    return writeLocal(KEYS.reviews, list);
  }

  try {
    const { error } = await supabase
      .from("reviews")
      .update({
        reply,
        replied_at: new Date().toISOString(),
        replied_by: adminName,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
      
    if (error) {
      // Check if the error is due to missing columns in schema cache
      if (error.message && (error.message.includes("column") || error.code === "PGRST204" || error.message.includes("schema cache"))) {
        console.warn("replied_at/replied_by columns missing in reviews table, retrying update without them...");
        const { error: retryError } = await supabase
          .from("reviews")
          .update({
            reply,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
    return id;
  } catch (error) {
    console.error("Error replying to review:", error);
    throw error;
  }
}

export async function deleteReview(id) {
  if (!supabaseReady) return localDelete(KEYS.reviews, id);

  try {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) throw error;
    await saveActivity({ type: "review", text: `Reseña eliminada: ${id}` });
    return id;
  } catch (error) {
    console.error("Error deleting review:", error);
    throw error;
  }
}

export async function deleteMessage(id) {
  if (!supabaseReady) return localDelete(KEYS.messages, id);

  try {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) throw error;
    await saveActivity({ type: "message", text: `Mensaje eliminado: ${id}` });
    return id;
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
}

export async function incrementGuideViews(id) {
  // Read local guides first
  const localList = readLocal(KEYS.guides, []);
  const updatedLocal = localList.map((item) =>
    String(item.id) === String(id) ? { ...item, views: (Number(item.views) || 0) + 1 } : item
  );
  writeLocal(KEYS.guides, updatedLocal);

  if (supabaseReady) {
    try {
      const { data: guideData } = await supabase
        .from("guides")
        .select("views")
        .eq("id", id)
        .single();

      const currentViews = guideData ? (Number(guideData.views) || 0) : 0;
      await supabase
        .from("guides")
        .update({ views: currentViews + 1 })
        .eq("id", id);
    } catch (error) {
      console.warn("No se pudo incrementar views en Supabase (puede faltar la columna 'views'):", error);
    }
  }
}

export async function saveActivity(activity) {
  if (!supabaseReady) {
    localUpsert(KEYS.activity, {
      ...activity,
      createdAt: new Date().toISOString()
    });
    return;
  }

  try {
    const { error } = await supabase
      .from("activity")
      .insert([{
        type: activity.type || "system",
        text: activity.text || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      console.error("Activity Error:", error);
    }
  } catch (err) {
    // Ignorar error si tabla no existe
  }
}
// Funciones de modo local (mantener compatibilidad)
export function saveLocalUser(user) {
  if (supabaseReady) return;
  localUpsert(KEYS.users, { ...user, role: user.role || "user" });
}

export function localUsers() {
  ensureLocalSeed();
  return readLocal(KEYS.users, []);
}

export function getLocalSession() {
  try {
    return JSON.parse(sessionStorage.getItem("learnmore.session"));
  } catch {
    return null;
  }
}

export function setLocalSession(session) {
  sessionStorage.setItem("learnmore.session", JSON.stringify(session));
}

export function clearLocalSession() {
  sessionStorage.removeItem("learnmore.session");
}

export function getLocalCurrentUser() {
  const session = getLocalSession();
  if (!session?.email) return null;
  return localUsers().find((user) => user.email === session.email) || session;
}

export function addActivity(activity) {
  if (supabaseReady) {
    saveActivity(activity);
    return;
  }
  localUpsert(KEYS.activity, { ...activity, createdAt: new Date().toISOString() });
}

// Helper functions for matricula generation
export function getCuatrimestreFromDate(date) {
  const month = date.getMonth() + 1;
  if (month >= 9 && month <= 12) return 0;
  else if (month >= 1 && month <= 4) return 1;
  else return 2;
}

export function getCareerCodeFromName(careerName) {
  if (!careerName) return "00";

  const normalized = careerName.toLowerCase().trim();

  if (normalized === "01") return "01";
  if (normalized === "02") return "02";
  if (normalized === "03") return "03";

  if (normalized.includes("mecatronica") || normalized.includes("mecatrónica")) return "01";
  else if (normalized.includes("ti") || normalized.includes("innovacion") || normalized.includes("innovación") || normalized.includes("digital")) return "02";
  else if (normalized.includes("procesos") || normalized.includes("industriales")) return "03";
  else return "01";
}

export function getCareerNameFromCode(code) {
  const normalized = String(code || "").trim();
  if (normalized === "01") return "Mecatronica";
  if (normalized === "02") return "TI e Innovacion Digital";
  if (normalized === "03") return "Procesos Industriales";
  return "";
}

export function baseCareerOptions() {
  return defaultCareers.map((career) => ({ ...career }));
}

export function getCurrentAcademicPeriodIndex(date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const block = month >= 9 ? 0 : month <= 4 ? 1 : 2;
  const academicYear = block === 0 ? year : year - 1;
  return academicYear * 3 + block;
}

export function getMatriculaInfo(value, referenceDate = new Date()) {
  const normalized = String(value || "").trim().toUpperCase();
  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{3})$/);

  if (!match) {
    return {
      isValid: false,
      matricula: normalized,
      generationYear: null,
      careerCode: "",
      careerName: "",
      studentNumber: "",
      semester: "",
    };
  }

  const generationYear = 2000 + Number(match[1]);
  const careerCode = match[2];
  const studentNumber = match[3];
  const startPeriod = generationYear * 3;
  const semester = Math.max(0, getCurrentAcademicPeriodIndex(referenceDate) - startPeriod);

  return {
    isValid: ["01", "02", "03"].includes(careerCode),
    matricula: normalized,
    generationYear,
    careerCode,
    careerName: getCareerNameFromCode(careerCode),
    studentNumber,
    semester,
  };
}

export async function generateMatricula(careerName) {
  try {
    const currentYear = new Date().getFullYear();
    const generation = String(currentYear - 2000);
    const careerCode = getCareerCodeFromName(careerName);
    const now = new Date();
    const cuatrimestre = getCuatrimestreFromDate(now);

    let count = 0;

    if (supabaseReady) {
      const { data: users, error } = await supabase
        .from("users")
        .select("id, career, created_at")
        .eq("role", "user");

      if (error) throw error;

      if (users) {
        count = users.filter(user => {
          const userCareerCode = getCareerCodeFromName(user.career);
          if (userCareerCode !== careerCode) return false;
          const registrationDate = new Date(user.created_at);
          const userCuatrimestre = getCuatrimestreFromDate(registrationDate);
          return userCuatrimestre === cuatrimestre;
        }).length;
      }
    } else {
      const users = localUsers();
      count = users.filter(user => {
        const userCareerCode = getCareerCodeFromName(user.career);
        if (userCareerCode !== careerCode) return false;
        const registrationDate = new Date(user.createdAt || user.created_at);
        const userCuatrimestre = getCuatrimestreFromDate(registrationDate);
        return userCuatrimestre === cuatrimestre;
      }).length;
    }

    const consecutive = String(count + 1).padStart(3, '0');
    return `${generation}-${careerCode}-${consecutive}`;
  } catch (error) {
    console.error("Error generating matricula:", error);
    const currentYear = new Date().getFullYear();
    const generation = String(currentYear - 2000);
    return `${generation}-00-${Date.now().toString().slice(-3).padStart(3, '0')}`;
  }
}