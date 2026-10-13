import { config } from "dotenv";
import { defineConfig } from "prisma/config";
config({ path: ".env.local", quiet: true });
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      process.env.DATABASE_URL ?? "postgresql://127.0.0.1/health_unconfigured",
  },
});
