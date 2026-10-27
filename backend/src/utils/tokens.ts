import { createHash, randomBytes } from "node:crypto";

// Tokens de sesiones, invitaciones y restablecimientos: 32 bytes aleatorios. En la base de datos solo se guarda su
// hash, asi que una copia de la base de datos no sirve para entrar ni para usar un enlace pendiente.
export const generarToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const enDias = (dias: number, desde = new Date()) => new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);

export const enHoras = (horas: number, desde = new Date()) => new Date(desde.getTime() + horas * 60 * 60 * 1000);
