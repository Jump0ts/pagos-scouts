import "dotenv/config";
import { z } from "zod";

// Si falta o sobra algo en el entorno, la API no arranca: mejor fallar al inicio que a mitad de una peticion.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (source: NodeJS.ProcessEnv): Env => {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problemas = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Variables de entorno no validas: ${problemas}`);
  }
  return result.data;
};

export const env = parseEnv(process.env);
