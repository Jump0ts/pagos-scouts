// Cliente de la API. Web y API comparten dominio (D-9), asi que la cookie de sesion viaja sola.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Errores por campo que devuelve la API: { email: "No es un email válido" }.
    public readonly campos?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Opciones = {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  // Un fichero que se manda tal cual (por ejemplo, el Excel del listado).
  archivo?: Blob;
};

export const api = async <T>(ruta: string, { metodo = "GET", cuerpo, archivo }: Opciones = {}): Promise<T> => {
  const tipo = archivo ? "application/octet-stream" : cuerpo === undefined ? null : "application/json";
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(tipo ? { "Content-Type": tipo } : {}) },
      body: archivo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
  }

  if (res.status === 204) return undefined as T;
  const datos = (await res.json().catch(() => null)) as { error?: string; campos?: Record<string, string> } | null;
  if (!res.ok) {
    throw new ApiError(res.status, datos?.error ?? "Algo ha fallado. Inténtalo de nuevo.", datos?.campos);
  }
  return datos as T;
};

export const mensajeDeError = (error: unknown) =>
  error instanceof ApiError ? error.message : "Algo ha fallado. Inténtalo de nuevo.";

// Un fichero que genera la API (el Excel de un evento): se pide y se guarda con el nombre que propone el servidor.
export const descargar = async (ruta: string) => {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, { credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
  }
  if (!res.ok) {
    const datos = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, datos?.error ?? "Algo ha fallado. Inténtalo de nuevo.");
  }
  const cabecera = res.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecera)?.[1];
  const nombre = utf8 ? decodeURIComponent(utf8) : (/filename="([^"]+)"/i.exec(cabecera)?.[1] ?? "descarga");
  const url = URL.createObjectURL(await res.blob());
  const enlace = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nombre;
};
