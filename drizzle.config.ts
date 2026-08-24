import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { migrationUrl } from "./db/url";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl() },
  strict: true,
  verbose: true,
});
