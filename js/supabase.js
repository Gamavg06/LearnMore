// js/supabase.js — versión corregida (usa esm.sh que sí soporta ESM correctamente)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Credenciales ──────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://brjywswhmqwokqemaosr.supabase.co";
const SUPABASE_KEY  = "sb_publishable_SMLL8yxvLZeguy1I4Ojmhg_9VecCe5q";

// ── Cliente principal ─────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const supabaseReady = true;

// ── Auth helpers (misma firma que Firebase para no romper el resto del código) ─
export const auth = supabase.auth;

export const onAuthStateChanged = (callback) =>
  supabase.auth.onAuthStateChange((event, session) => callback(event, session));

export const signInWithEmailAndPassword = (...args) => {
  const [email, password] = args.length === 2 ? args : [args[1], args[2]];
  return supabase.auth.signInWithPassword({ email, password });
};

export const createUserWithEmailAndPassword = (...args) => {
  const [email, password] = args.length === 2 ? args : [args[1], args[2]];
  return supabase.auth.signUp({ email, password });
};

export const sendPasswordResetEmail = (...args) => {
  const email = args.length === 1 ? args[0] : args[1];
  return supabase.auth.resetPasswordForEmail(email);
};

export const signOut = () => supabase.auth.signOut();

// ── Firestore shims (mantienen compatibilidad con guides.js) ──────────────────
export const serverTimestamp = () => new Date().toISOString();

// colección / documento — devuelven un objeto descriptor, no hacen nada por sí solos
export const collection = (_db, table) => ({ table });
export const doc       = (_db, table, id) => ({ table, id });

// Escritura
export const addDoc = async ({ table }, data) => {
  const { data: row, error } = await supabase.from(table).insert(data).select().single();
  if (error) throw error;
  return { id: row.id, ...row };
};

export const setDoc = async ({ table, id }, data, options = {}) => {
  const payload = options.merge ? data : { id, ...data };
  const { error } = await supabase.from(table).upsert(payload);
  if (error) throw error;
};

export const deleteDoc = async ({ table, id }) => {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
};

// Lectura única
export const getDoc = async ({ table, id }) => {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return {
    exists: () => !!data,
    data:   () => data,
    id,
  };
};

// Tiempo real (sustituye onSnapshot de Firestore)
export const onSnapshot = ({ table, id }, callback) => {
  // Snapshot inicial
  (id
    ? supabase.from(table).select('*').eq('id', id).single()
    : supabase.from(table).select('*')
  ).then(({ data, error }) => {
    if (!error) callback({ docs: Array.isArray(data) ? data : [data], data: () => data });
  });

  // Suscripción en tiempo real
  const channel = supabase
    .channel(`rt-${table}-${id ?? 'all'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, async () => {
      const { data } = id
        ? await supabase.from(table).select('*').eq('id', id).single()
        : await supabase.from(table).select('*');
      callback({ docs: Array.isArray(data) ? data : [data], data: () => data });
    })
    .subscribe();

  // Devuelve función de limpieza (igual que Firestore)
  return () => supabase.removeChannel(channel);
};

// Storage shims (si los usas)
export const ref         = (_storage, path) => ({ path });
export const uploadBytes = async ({ path }, file) => {
  const { error } = await supabase.storage.from('files').upload(path, file, { upsert: true });
  if (error) throw error;
  return { ref: { path } };
};
export const getDownloadURL = async ({ path }) => {
  const { data } = supabase.storage.from('files').getPublicUrl(path);
  return data.publicUrl;
};
