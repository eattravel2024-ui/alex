-- AlterTable
ALTER TABLE "ArticleRecord" ADD COLUMN     "imageAlt" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "altText" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_id_idx" ON "MediaAsset"("createdAt", "id");

-- CreateIndex
CREATE INDEX "MediaAsset_createdById_createdAt_idx" ON "MediaAsset"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleRecord_image_idx" ON "ArticleRecord"("image");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Media invariants and historical reference lookups.
ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_valid_image" CHECK ("mimeType" = 'image/webp' AND width > 0 AND width <= 1600 AND height > 0 AND height <= 1200 AND "byteSize" > 0 AND "byteSize" <= 5242880);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_positive_version" CHECK (version > 0);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_valid_alt" CHECK (length(btrim("altText")) BETWEEN 1 AND 160);
ALTER TABLE "ArticleRecord" ADD CONSTRAINT "article_image_alt_length" CHECK (length("imageAlt") <= 160);
CREATE INDEX "article_revision_media_image_idx" ON "ArticleRevision" ((snapshot->>'image'));
