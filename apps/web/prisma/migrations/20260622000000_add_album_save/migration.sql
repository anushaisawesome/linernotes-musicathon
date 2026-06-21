-- CreateTable
CREATE TABLE "AlbumSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumReviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumSave_userId_idx" ON "AlbumSave"("userId");

-- CreateIndex
CREATE INDEX "AlbumSave_albumReviewId_idx" ON "AlbumSave"("albumReviewId");

-- CreateIndex
CREATE INDEX "AlbumSave_createdAt_idx" ON "AlbumSave"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumSave_userId_albumReviewId_key" ON "AlbumSave"("userId", "albumReviewId");

-- AddForeignKey
ALTER TABLE "AlbumSave" ADD CONSTRAINT "AlbumSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumSave" ADD CONSTRAINT "AlbumSave_albumReviewId_fkey" FOREIGN KEY ("albumReviewId") REFERENCES "AlbumReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
