-- CreateTable
CREATE TABLE "SitePage" (
    "key" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "publishedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SitePageRevision" (
    "id" UUID NOT NULL,
    "pageKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitePageRevision_pageKey_version_key" ON "SitePageRevision"("pageKey", "version");

-- AddForeignKey
ALTER TABLE "SitePageRevision" ADD CONSTRAINT "SitePageRevision_pageKey_fkey" FOREIGN KEY ("pageKey") REFERENCES "SitePage"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePageRevision" ADD CONSTRAINT "SitePageRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SitePage" ADD CONSTRAINT "site_page_key" CHECK (key IN ('home','about'));
ALTER TABLE "SitePage" ADD CONSTRAINT "site_page_version" CHECK (version > 0);
ALTER TABLE "SitePage" ADD CONSTRAINT "site_page_publication_pair" CHECK ((published IS NULL) = ("publishedAt" IS NULL));
ALTER TABLE "SitePageRevision" ADD CONSTRAINT "site_page_revision_version" CHECK (version > 0);
