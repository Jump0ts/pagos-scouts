// Error con codigo HTTP: lo que se lanza desde las rutas y convierte en respuesta el errorHandler.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (message = "No encontrado") => new HttpError(404, message);
