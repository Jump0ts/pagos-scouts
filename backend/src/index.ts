import { createApp } from "./app.js";
import { env } from "./env.js";
import { limpiarEnviosCaducados } from "./modules/pedidos/pedidos.utils.js";

const app = createApp();

// D-70: los envios de pedidos que nadie reviso se borran solos. Al arrancar y cada 12 horas.
const limpiar = () =>
  limpiarEnviosCaducados()
    .then((n) => n && console.log(`[pagos-scouts-api] ${n} envíos de pedidos caducados borrados`))
    .catch((e) => console.error("[pagos-scouts-api] no se han podido borrar los envíos caducados", e));
void limpiar();
setInterval(limpiar, 12 * 60 * 60 * 1000).unref();

app.listen(env.PORT, () => {
  console.log(`[pagos-scouts-api] escuchando en el puerto ${env.PORT} (entorno: ${env.NODE_ENV})`);
});
