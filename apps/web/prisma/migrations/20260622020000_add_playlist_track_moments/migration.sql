-- AlterTable: per-track written take, stored structurally alongside moments.
ALTER TABLE "PlaylistTrack" ADD COLUMN "take" TEXT;

-- CreateTable: timestamped moments on a playlist track (mirrors Note on Review).
CREATE TABLE "PlaylistTrackNote" (
    "id" TEXT NOT NULL,
    "playlistTrackId" TEXT NOT NULL,
    "seconds" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "lyric" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistTrackNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaylistTrackNote_playlistTrackId_idx" ON "PlaylistTrackNote"("playlistTrackId");

-- AddForeignKey
ALTER TABLE "PlaylistTrackNote" ADD CONSTRAINT "PlaylistTrackNote_playlistTrackId_fkey" FOREIGN KEY ("playlistTrackId") REFERENCES "PlaylistTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
