import { config } from "dotenv";

/**
 * Loads environment files for the command-line scripts (migrate, seed, drizzle-kit).
 *
 * Next.js reads `.env.local` on its own, but `dotenv/config` reads only `.env`, so
 * without this a value put in `.env.local` would work in `npm run dev` and then fail
 * in `npm run db:migrate` with a confusing "DATABASE_URL is not set". Both files are
 * read here, in Next's own precedence order: `.env.local` wins, `.env` fills gaps.
 *
 * Import this before anything that reads process.env.
 */
config({ path: [".env.local", ".env"], quiet: true });
