// js/migrar.js
import { supabase, supabaseReady } from './supabase.js';
import { defaultCareers, defaultGuides } from "./guides.js";

export async function ejecutarMigracionAutomatica() {
  if (!supabaseReady) {
    console.warn("Supabase no está listo. El sistema opera en modo LocalStorage.");
    return;
  }

  try {
    console.log("🔄 Base de datos en la nube vacía detectada. Iniciando migración automática a Supabase...");

    // 1. Migrar todas las carreras predefinidas (mec, ti, proc)
    for (const carrera of defaultCareers) {
      const { error } = await supabase.from("careers").upsert({
        id: carrera.id,
        name: carrera.name,
        description: carrera.desc || carrera.description,
        color: carrera.color,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      console.log(`🔹 Carrera migrada con éxito: [${carrera.id.toUpperCase()}] ${carrera.name}`);
    }

    // 2. Migrar todas las guías académicas predefinidas
    for (const guia of defaultGuides) {
      const { error } = await supabase.from("guides").upsert({
        id: guia.id,
        title: guia.title,
        desc: guia.desc,
        detail: guia.detail,
        career: guia.career,
        sem: Number(guia.sem),
        topics: guia.topics,
        fileUrl: guia.fileUrl || "",
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      console.log(`🔹 Guía migrada con éxito: ${guia.title}`);
    }

    console.log("🎉 ¡Migración e inicialización de Supabase completadas con éxito!");
  } catch (error) {
    console.error("❌ Error crítico durante la migración a Supabase:", error);
  }
}