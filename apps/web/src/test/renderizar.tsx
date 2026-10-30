import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate, useRoutes, type NavigateFunction } from "react-router";
import type { Perfil } from "@/features/auth/auth.types";
import { rutas } from "@/router";

// Datos inventados para los tests de la web.
export const PERFIL_ADMIN: Perfil = {
  usuario: { id: "u1", nombre: "Ana Pinar", email: "ana@pinar.test" },
  grupos: [
    { id: "g1", nombre: "Grupo Scout Pinar", rol: "ADMIN" },
    { id: "g2", nombre: "Grupo Scout Río", rol: "SCOUTER" },
  ],
  grupoActivo: { id: "g1", nombre: "Grupo Scout Pinar", rol: "ADMIN", seccionIds: [] },
};

export const SECCIONES = [
  { id: "s1", nombre: "Castores", orden: 0, color: "castores", edadMaxima: 7, archivada: false },
  { id: "s2", nombre: "Manada", orden: 1, color: "manada", edadMaxima: 10, archivada: false },
  { id: "s3", nombre: "Tropa", orden: 2, color: "tropa", edadMaxima: 13, archivada: false },
];

type Respuesta = { status?: number; cuerpo?: unknown };
type Manejador = (cuerpo: unknown) => Respuesta;

// fetch falso: "GET /auth/yo" -> respuesta. Devuelve el mock para comprobar llamadas.
export const simularApi = (rutasApi: Record<string, Manejador | Respuesta>) => {
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const clave = `${init?.method ?? "GET"} ${url.replace(/^\/api/, "")}`;
    const definida = rutasApi[clave];
    if (!definida) return new Response(JSON.stringify({ error: `Sin simular: ${clave}` }), { status: 500 });
    // Los ficheros (subida del listado) llegan tal cual; solo el JSON se interpreta.
    const cuerpo = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    const { status = 200, cuerpo: respuesta } = typeof definida === "function" ? definida(cuerpo) : definida;
    return status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify(respuesta ?? {}), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
};

// Las mismas rutas que la app, con un router en memoria: el router de datos crea objetos Request con un
// AbortSignal de jsdom que el fetch de Node rechaza, y aqui no hacen falta loaders.
export const renderizar = (ruta: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const estado = { ruta: ruta, navegar: (() => undefined) as NavigateFunction };

  const Rutas = () => {
    estado.ruta = useLocation().pathname;
    estado.navegar = useNavigate();
    return useRoutes(rutas);
  };

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Rutas />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ruta: () => estado.ruta, navegar: (a: string) => estado.navegar(a) };
};
