import { createBrowserRouter, Navigate } from "react-router";
import { AjustesInicio, AjustesPagina } from "./features/ajustes/AjustesPagina";
import { MiCuenta } from "./features/ajustes/MiCuenta";
import { InvitacionPagina } from "./features/auth/InvitacionPagina";
import { LoginPagina } from "./features/auth/LoginPagina";
import { RestablecerPagina } from "./features/auth/RestablecerPagina";
import { RutaProtegida, SoloRol } from "./features/auth/RutaProtegida";
import { CursoAjustes } from "./features/cursos/CursoAjustes";
import { PasoCursoPagina } from "./features/cursos/PasoCursoPagina";
import { EducandosPagina } from "./features/educandos/EducandosPagina";
import { EventoDetallePagina } from "./features/eventos/EventoDetallePagina";
import { EventoFormularioPagina } from "./features/eventos/EventoFormularioPagina";
import { EventosPagina } from "./features/eventos/EventosPagina";
import { ImportarListadoPagina } from "./features/importaciones/ImportarListadoPagina";
import { InicioPagina } from "./features/inicio/InicioPagina";
import { DudaPagina } from "./features/movimientos/DudaPagina";
import { ImportarMovimientosPagina } from "./features/movimientos/ImportarMovimientosPagina";
import { MovimientosPagina } from "./features/movimientos/MovimientosPagina";
import { PagoManualPagina } from "./features/movimientos/PagoManualPagina";
import { FormularioPedidoPagina } from "./features/pedidos/FormularioPedidoPagina";
import { PedidoDetallePagina } from "./features/pedidos/PedidoDetallePagina";
import { PedidoFormularioPagina } from "./features/pedidos/PedidoFormularioPagina";
import { SeccionesAjustes } from "./features/secciones/SeccionesAjustes";
import { InstalarAjustes } from "./features/pwa/InstalarAjustes";
import { PersonasAjustes } from "./features/usuarios/PersonasAjustes";
import { AppLayout } from "./layout/AppLayout";

export const rutas = [
  // Publicas
  { path: "/login", element: <LoginPagina /> },
  { path: "/invitacion/:token", element: <InvitacionPagina /> },
  { path: "/restablecer/:token", element: <RestablecerPagina /> },
  // D-67: el formulario de un pedido para las familias; el codigo va detras del #.
  { path: "/pedido", element: <FormularioPedidoPagina /> },

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
          { path: "eventos/pedidos/:id", element: <PedidoDetallePagina /> },
          {
            element: <SoloRol roles={["ADMIN", "TESORERIA"]} />,
            children: [
              { path: "educandos/importar", element: <ImportarListadoPagina /> },
              { path: "eventos/nuevo", element: <EventoFormularioPagina /> },
              { path: "eventos/:id/editar", element: <EventoFormularioPagina /> },
              { path: "eventos/pedidos/nuevo", element: <PedidoFormularioPagina /> },
              { path: "eventos/pedidos/:id/editar", element: <PedidoFormularioPagina /> },
              { path: "movimientos", element: <MovimientosPagina /> },
              { path: "movimientos/importar", element: <ImportarMovimientosPagina /> },
              { path: "movimientos/nuevo", element: <PagoManualPagina /> },
              { path: "movimientos/:id", element: <DudaPagina /> },
            ],
          },
          {
            path: "ajustes",
            element: <AjustesPagina />,
            children: [
              { index: true, element: <AjustesInicio /> },
              { path: "mi-cuenta", element: <MiCuenta /> },
              { path: "instalar", element: <InstalarAjustes /> },
              {
                element: <SoloRol roles={["ADMIN"]} />,
                children: [
                  { path: "personas", element: <PersonasAjustes /> },
                  { path: "secciones", element: <SeccionesAjustes /> },
                  { path: "curso", element: <CursoAjustes /> },
                  { path: "curso/paso", element: <PasoCursoPagina /> },
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
