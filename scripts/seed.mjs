import { config } from "dotenv";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { allArticles } from "../src/lib/catalog.ts";
config({ path: ".env.local", quiet: true });
if (
  process.env.DEVELOPMENT_MODE !== "true" ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error(
    "Seed is only allowed on explicitly configured local development databases.",
  );
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const [code, name] of [
    ["DEMO_PERSONAL", "示範個人會員"],
    ["DEMO_GROUP", "示範團體會員"],
  ])
    await pool.query(
      'INSERT INTO "MembershipType" (id,code,name,description,active,"isDemo") VALUES ($1,$2,$3,$4,true,true) ON CONFLICT (code) DO NOTHING',
      [randomUUID(), code, name, "僅供開發測試，不代表協會正式入會規則。"],
    );
  for (const a of allArticles) {
    await pool.query(
      `INSERT INTO "ArticleRecord" (id,slug,kind,status,title,summary,category,tags,image,author,featured,"reviewedAt",blocks,"references","searchText","publishAt",version,"isDemo","updatedAt")
       VALUES ($1,$2,$3,'PUBLISHED',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,1,true,now()) ON CONFLICT (slug) DO NOTHING`,
      [
        randomUUID(),
        a.slug,
        a.kind,
        a.title,
        a.summary,
        a.category,
        a.tags,
        a.image,
        a.author,
        a.featured,
        a.reviewedAt,
        JSON.stringify(a.blocks),
        JSON.stringify(a.references),
        [
          a.title,
          a.summary,
          ...a.tags,
          ...a.blocks.flatMap((b) => [b.heading, ...b.paragraphs]),
        ].join(" "),
        a.publishedAt + "T00:00:00+08:00",
      ],
    );
  }
  console.log(
    "Demo membership types and articles seeded without overwriting existing records; no user/admin accounts or default passwords created.",
  );
} finally {
  await pool.end();
}
