// Version-pinned Prisma in-process client generator. No native engine artifacts used.
import internals from "@prisma/internals";
import { createRequire } from "node:module";
const { PrismaClientTsGenerator } = createRequire(import.meta.url)(
  "@prisma/client-generator-ts",
);
const generators = await internals.getGenerators({
  schemaPath: "prisma/schema.prisma",
  registry: {
    "prisma-client": {
      type: "in-process",
      generator: new PrismaClientTsGenerator(),
    },
  },
  cliCommand: "npm run db:generate",
});
try {
  for (const generator of generators) await generator.generate();
  console.log(
    "Prisma Client generated using official version-pinned JavaScript/WASM tooling.",
  );
} finally {
  for (const generator of generators) generator.stop();
}
