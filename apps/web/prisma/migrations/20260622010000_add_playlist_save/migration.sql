-- CreateTable
CREATE TABLE "PlaylistSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaylistSave_userId_idx" ON "PlaylistSave"("userId");

-- CreateIndex
CREATE INDEX "PlaylistSave_playlistId_idx" ON "PlaylistSave"("playlistId");

-- CreateIndex
CREATE INDEX "PlaylistSave_createdAt_idx" ON "PlaylistSave"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistSave_userId_playlistId_key" ON "PlaylistSave"("userId", "playlistId");

-- AddForeignKey
ALTER TABLE "PlaylistSave" ADD CONSTRAINT "PlaylistSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistSave" ADD CONSTRAINT "PlaylistSave_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
