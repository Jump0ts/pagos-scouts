// Error con codigo HTTP: lo que se lanza desde las rutas y convierte en respuesta el errorHandler.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Errores por campo de un formulario: { email: "No es un email válido" }.
    public readonly campos?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, campos?: Record<string, string>) => new HttpError(400, message, campos);
export const unauthorized = (message = "Inicia sesión para continuar") => new HttpError(401, message);
export const forbidden = (message = "No tienes permiso para hacer esto") => new HttpError(403, message);
export const notFound = (message = "No encontrado") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const tooManyRequests = (message: string) => new HttpError(429, message);
