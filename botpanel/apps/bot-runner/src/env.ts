import { config } from "dotenv";
import { z } from "zod";

config({ path: [".env", "../../.env"], quiet: true });

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "TOKEN_ENCRYPTION_KEY muss 64 Hex-Zeichen haben"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Fehlerhafte Umgebungsvariablen (.env):");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
