import { config } from "dotenv";
import { z } from "zod";

// .env im App-Ordner oder im Monorepo-Wurzelordner; in Docker kommen die Werte aus docker-compose.
config({ path: [".env", "../../.env"], quiet: true });

const schema = z.object({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.url(),
  PUBLIC_URL: z.url(),
  API_PORT: z.coerce.number().int().default(3000),
  API_HOST: z.string().default("0.0.0.0"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET muss mindestens 32 Zeichen lang sein"),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "TOKEN_ENCRYPTION_KEY muss 64 Hex-Zeichen haben"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  WEB_DIST: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Fehlerhafte Umgebungsvariablen (.env):");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isHttps = env.PUBLIC_URL.startsWith("https://");
