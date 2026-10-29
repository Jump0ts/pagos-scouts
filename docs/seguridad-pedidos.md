# Seguridad del formulario de pedidos

El formulario de pedidos (D-66 a D-70) es la única parte de la web en la que puede escribir alguien sin cuenta. Este
documento recoge contra qué se protege, cómo y qué test lo comprueba. Si cambia algo de esto, se actualiza aquí.

## Qué hay expuesto

- `GET /api/publico/pedido`, con el código del enlace en la cabecera `X-Enlace-Pedido`: devuelve el nombre del grupo,
  el del pedido, las instrucciones de pago, las secciones y el catálogo. **Nunca** datos del listado del grupo.
- `POST /api/publico/pedido`: guarda un envío **pendiente**. No crea cargos ni toca nada más del grupo.
- La página `/pedido#<código>` de la web.

## Amenazas y defensas

| Amenaza | Defensa | Dónde | Test |
|---|---|---|---|
| Adivinar el enlace de un pedido | Código aleatorio de 32 bytes; mismo 404 para un código falso, antiguo o de un pedido cerrado, sin pistas | `publico.routes.ts` | `pedidos.test.ts` «el mismo 404…» |
| El enlace se filtra (reenviado, en un registro) | El código va detrás del `#`: el navegador no lo manda al pedir la página ni en el `Referer`; la API lo recibe en una cabecera, no en la URL. Tesorería puede cambiar el enlace y el anterior deja de funcionar. Solo sirve con el pedido abierto | `pedidos.utils.ts`, `pedidoPublico.api.ts` | «el mismo 404…», web «el código va en una cabecera» |
| Ver datos de menores con el enlace | La respuesta pública no incluye el listado; la familia escribe el nombre a mano | `publico.routes.ts` | «nunca el listado» |
| Crear cargos o pagos falsos | Lo enviado queda pendiente hasta que Tesorería lo acepta y elige a quién corresponde | `pedidos.routes.ts` | «semáforo, aceptar…» |
| Bots que rellenan formularios | Justificante firmado por la API (HMAC con clave en memoria) con tiempo mínimo de 4 s y caducidad de 12 h; campo trampa que descarta en silencio | `publico.proteccion.ts` | «demasiado rápido…», «campo trampa» |
| Inundar la bandeja o la base de datos | Límites por IP en nginx (20/min, 32 KB) y en la API (10 envíos/hora, 60 lecturas/10 min); tope de 300 envíos pendientes por pedido; máximo 30 líneas por envío | `scouts.conf`, `publico.proteccion.ts`, `pedidos.schema.ts` | «límite de envíos por IP», «tope de envíos pendientes» |
| Campos inesperados o manipulados | Validación estricta con Zod (`strict`): ningún campo de más; la sección y cada artículo, opción y valor se comprueban contra el pedido y su grupo | `pedidos.schema.ts`, `pedidos.calculo.ts` | «rechaza campos inesperados…» |
| Inyección en Excel (`=HYPERLINK(...)`) | Los textos solo admiten letras, números, espacios y signos sencillos, y tienen que empezar por letra o número; además, al exportar, todo texto que empiece por `=`, `+`, `-` o `@` se neutraliza | `pedidos.schema.ts`, `utils/hoja.ts` | `pedidos.calculo.test.ts` |
| XSS con lo que escribe una familia | React escapa siempre el texto y la CSP de la web no permite scripts en línea; además, los textos no admiten `<` ni `>` | web, `deploy/web-nginx/nginx.conf` | «rechaza… textos peligrosos» |
| CSRF desde otra web | La API rechaza peticiones que cambian datos con un `Origin` distinto; el formulario no usa cookies (`credentials: "omit"`) | `middleware/origen.ts` | `auth.test.ts` |
| Cruzar grupos | Todas las rutas internas filtran por el grupo de la sesión; aceptar un envío exige alguien matriculado en ese grupo y curso | `pedidos.routes.ts`, `pedidos.utils.ts` | «otro grupo no ve ni toca…», «no se acepta para alguien de otro grupo» |
| Guardar datos de más | No se pide correo, teléfono ni ficheros; al aceptar o rechazar, el envío se borra; los pendientes se borran 30 días después de cerrar el pedido | `pedidos.utils.ts`, `index.ts` | «los envíos sin revisar se borran…» |

## Lo que se descartó

- **Cloudflare Turnstile** (D-69): obligaría a dar salida a Internet a la API, que vive aislada (D-61), y a ampliar la
  CSP. Un bot no puede crear cargos, así que el beneficio no compensa. Si algún día hubiera abuso de verdad, sería una
  decisión nueva.
- **Enlaces de edición para las familias** (D-68): cualquiera con ese enlace podría ver y cambiar el pedido. Un
  segundo envío llega como posible cambio y Tesorería decide.
