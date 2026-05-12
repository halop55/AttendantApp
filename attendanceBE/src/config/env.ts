import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().positive().default(3031),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  LOGTO_ENDPOINT: z.url(),
  LOGTO_AUDIENCE: z.string().min(1),
  LOGTO_SCOPE: z.string().min(0),
  FIREBASE_PROJECT_ID: z.string().min(1).default("chat-messenger-71c1e"),
});

export const env = envSchema.parse(process.env);
