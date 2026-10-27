// D-16. Este dominio es el dueño del concepto de rol: el resto lo importa de aquí.
export type Rol = "ADMIN" | "TESORERIA" | "SCOUTER";

export type Perfil = {
  usuario: { id: string; nombre: string; email: string };
  grupos: { id: string; nombre: string; rol: Rol }[];
  grupoActivo: { id: string; nombre: string; rol: Rol; seccionIds: string[] } | null;
};

export type InfoInvitacion = {
  grupo: { nombre: string };
  email: string;
  rol: Rol;
  usuarioExiste: boolean;
};
