import { firebaseReady, db, doc, setDoc } from "./firebase.js";
import { defaultCareers, defaultGuides } from "./guides.js";

export async function ejecutarMigracionAutomatica() {
  if (!firebaseReady) {
    console.warn("Firebase no está listo. El sistema opera en modo LocalStorage.");
    return;
  }

  try {
    console.log("🔄 Base de datos en la nube vacía detectada. Iniciando migración automática a Cloud Firestore...");

    // 1. Migrar todas las carreras predefinidas (mec, ti, proc)
    for (const carrera of defaultCareers) {
      await setDoc(doc(db, "careers", carrera.id), {
        key: carrera.key,
        name: carrera.name,
        desc: carrera.desc,
        color: carrera.color,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`🔹 Carrera migrada con éxito: [${carrera.key.toUpperCase()}] ${carrera.name}`);
    }

    // 2. Migrar todas las guías académicas predefinidas
    for (const guia of defaultGuides) {
      await setDoc(doc(db, "guides", guia.id), {
        title: guia.title,
        desc: guia.desc,
        detail: guia.detail,
        career: guia.career,
        sem: Number(guia.sem),
        topics: guia.topics,
        fileUrl: guia.fileUrl || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`🔹 Guía migrada con éxito: ${guia.title}`);
    }

    console.log("🎉 ¡Migración e inicialización de Cloud Firestore completadas con éxito!");
  } catch (error) {
    console.error("❌ Error crítico durante la migración a Firebase:", error);
  }
}