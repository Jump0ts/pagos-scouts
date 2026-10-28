import type { Rol } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app.js";
import { crearGrupo } from "../src/modules/grupos/grupos.utils.js";

// Datos inventados: nunca nombres reales en los tests (el repositorio es publico).
export const app = createApp();
export const CONTRASENA = "una-contrasena-larga";

export const tokenDe = (enlace: string) => enlace.split("/").at(-1)!;

// Grupo nuevo con su administrador ya dado de alta (via la invitacion, como en la realidad) y con sesion abierta.
export const grupoConAdmin = async (nombre = "Grupo Scout Pinar", email = "admin@pinar.test") => {
  const { grupo, enlace } = await crearGrupo(nombre, email);
  const admin = request.agent(app);
  await admin
    .post(`/api/invitaciones/${tokenDe(enlace)}/aceptar`)
    .send({ nombre: "Admin Pinar", contrasena: CONTRASENA })
    .expect(201);
  return { grupo, admin };
};

export const seccionesDe = async (agente: request.Agent) => {
  const res = await agente.get("/api/secciones").expect(200);
  return res.body.secciones as { id: string; nombre: string; orden: number; color: string; archivada: boolean }[];
};

// Invita a alguien desde el admin y acepta la invitacion; devuelve su agente (con sesion) y su membresia.
export const invitarYAceptar = async (
  admin: request.Agent,
  email: string,
  rol: Rol,
  seccionIds: string[] = [],
) => {
  const invitacion = await admin.post("/api/usuarios/invitaciones").send({ email, rol, seccionIds }).expect(201);
  const agente = request.agent(app);
  const perfil = await agente
    .post(`/api/invitaciones/${tokenDe(invitacion.body.enlace)}/aceptar`)
    .send({ nombre: `Persona ${rol}`, contrasena: CONTRASENA })
    .expect(201);
  const lista = await admin.get("/api/usuarios").expect(200);
  const miembro = lista.body.miembros.find((m: { usuario: { email: string } }) => m.usuario.email === email);
  return { agente, perfil: perfil.body, membresiaId: miembro.membresiaId as string };
};
