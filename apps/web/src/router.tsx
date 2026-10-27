import { createBrowserRouter, Navigate } from "react-router";
import { AjustesInicio, AjustesPagina } from "./features/ajustes/AjustesPagina";
import { MiCuenta } from "./features/ajustes/MiCuenta";
import { InvitacionPagina } from "./features/auth/InvitacionPagina";
import { LoginPagina } from "./features/auth/LoginPagina";
import { RestablecerPagina } from "./features/auth/RestablecerPagina";
import { RutaProtegida, SoloRol } from "./features/auth/RutaProtegida";
import { EducandosPagina } from "./features/educandos/EducandosPagina";
import { EventoDetallePagina } from "./features/eventos/EventoDetallePagina";
import { EventoFormularioPagina } from "./features/eventos/EventoFormularioPagina";
import { EventosPagina } from "./features/eventos/EventosPagina";
import { ImportarListadoPagina } from "./features/importaciones/ImportarListadoPagina";
import { InicioPagina } from "./features/inicio/InicioPagina";
import { ImportarMovimientosPagina } from "./features/movimientos/ImportarMovimientosPagina";
import { MovimientosPagina } from "./features/movimientos/MovimientosPagina";
import { SeccionesAjustes } from "./features/secciones/SeccionesAjustes";
import { PersonasAjustes } from "./features/usuarios/PersonasAjustes";
import { AppLayout } from "./layout/AppLayout";

export const rutas = [
  // Publicas
  { path: "/login", element: <LoginPagina /> },
  { path: "/invitacion/:token", element: <InvitacionPagina /> },
  { path: "/restablecer/:token", element: <RestablecerPagina /> },

  // Con sesion
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <InicioPagina /> },
          { path: "educandos", element: <EducandosPagina /> },
          { path: "eventos", element: <EventosPagina /> },
          { path: "eventos/:id", element: <EventoDetallePagina /> },
          {
            element: <SoloRol roles={["ADMIN", "TESORERIA"]} />,
            children: [
              { path: "educandos/importar", element: <ImportarListadoPagina /> },
              { path: "eventos/nuevo", element: <EventoFormularioPagina /> },
              { path: "eventos/:id/editar", element: <EventoFormularioPagina /> },
              { path: "movimientos", element: <MovimientosPagina /> },
              { path: "movimientos/importar", element: <ImportarMovimientosPagina /> },
            ],
          },
          {
            path: "ajustes",
            element: <AjustesPagina />,
            children: [
              { index: true, element: <AjustesInicio /> },
              { path: "mi-cuenta", element: <MiCuenta /> },
              {
                element: <SoloRol roles={["ADMIN"]} />,
                children: [
                  { path: "personas", element: <PersonasAjustes /> },
                  { path: "secciones", element: <SeccionesAjustes /> },
                ],
              },
            ],
          },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(rutas);
