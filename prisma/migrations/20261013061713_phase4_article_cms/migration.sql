-- CreateEnum
CREATE TYPE "ArticleKind" AS ENUM ('news', 'knowledge');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ArticleRecord" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ArticleKind" NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "image" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TEXT,
    "blocks" JSONB NOT NULL,
    "references" JSONB NOT NULL,
    "searchText" TEXT NOT NULL,
    "publishAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ArticleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleRevision" (
    "id" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleRecord_slug_key" ON "ArticleRecord"("slug");

-- CreateIndex
CREATE INDEX "ArticleRecord_kind_status_publishAt_idx" ON "ArticleRecord"("kind", "status", "publishAt");

-- CreateIndex
CREATE INDEX "ArticleRecord_category_kind_idx" ON "ArticleRecord"("category", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleRevision_articleId_version_key" ON "ArticleRevision"("articleId", "version");

-- AddForeignKey
ALTER TABLE "ArticleRecord" ADD CONSTRAINT "ArticleRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "ArticleRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CMS invariants: every visible or scheduled article has a publication timestamp.
ALTER TABLE "ArticleRecord" ADD CONSTRAINT "article_positive_version" CHECK (version > 0);
ALTER TABLE "ArticleRecord" ADD CONSTRAINT "article_publication_time" CHECK (status NOT IN ('PUBLISHED','SCHEDULED') OR "publishAt" IS NOT NULL);
CREATE INDEX "ArticleRecord_tags_gin" ON "ArticleRecord" USING GIN (tags);
