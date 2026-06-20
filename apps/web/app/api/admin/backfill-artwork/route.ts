import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpotifyAppToken, searchTracks, searchAlbums } from "@/lib/spotify";

/**
 * POST /api/admin/backfill-artwork?key=<NEXTAUTH_SECRET>
 * One-time maintenance: re-fetch existing reviews' cover art from Spotify
 * (high-res). Only updates a row when a confident match is found AND the new
 * art is actually a Spotify image; rows already on Spotify art are skipped.
 */

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isSpotifyArt = (u?: string | null) => !!u && u.includes("i.scdn.co");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key || key !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getSpotifyAppToken();
  if (!token) {
    return NextResponse.json({ error: "Spotify unavailable" }, { status: 502 });
  }

  const result = {
    tracks: { total: 0, updated: 0, skipped: 0, failed: 0 },
    albums: { total: 0, updated: 0, skipped: 0, failed: 0 },
  };

  // ── Track reviews ──────────────────────────────────────────────
  const reviews = await prisma.review.findMany({
    select: { id: true, trackName: true, trackArtist: true, artworkUrl: true },
  });
  result.tracks.total = reviews.length;
  for (const r of reviews) {
    if (isSpotifyArt(r.artworkUrl)) { result.tracks.skipped++; continue; }
    try {
      const matches = await searchTracks(`${r.trackName} ${r.trackArtist}`, token);
      const rn = norm(r.trackName), ra = norm(r.trackArtist);
      const best = matches.find((m) => {
        const mn = norm(m.name), ma = norm(m.artist);
        const nameOk = mn === rn || mn.startsWith(rn) || rn.startsWith(mn);
        const artistOk = ma.includes(ra) || ra.includes(ma);
        return nameOk && artistOk;
      });
      if (best && isSpotifyArt(best.artworkUrl)) {
        await prisma.review.update({ where: { id: r.id }, data: { artworkUrl: best.artworkUrl } });
        result.tracks.updated++;
      } else {
        result.tracks.skipped++;
      }
    } catch {
      result.tracks.failed++;
    }
    await sleep(110);
  }

  // ── Album reviews ──────────────────────────────────────────────
  const albumReviews = await prisma.albumReview.findMany({
    select: { id: true, albumName: true, albumArtist: true, artworkUrl: true },
  });
  result.albums.total = albumReviews.length;
  for (const a of albumReviews) {
    if (isSpotifyArt(a.artworkUrl)) { result.albums.skipped++; continue; }
    try {
      const matches = await searchAlbums(`${a.albumName} ${a.albumArtist}`, token);
      const an = norm(a.albumName), aa = norm(a.albumArtist);
      const best = matches.find((m) => {
        const mn = norm(m.name), ma = norm(m.artist);
        const nameOk = mn === an || mn.startsWith(an) || an.startsWith(mn);
        const artistOk = ma.includes(aa) || aa.includes(ma);
        return nameOk && artistOk;
      });
      if (best && isSpotifyArt(best.artworkUrl)) {
        await prisma.albumReview.update({ where: { id: a.id }, data: { artworkUrl: best.artworkUrl } });
        result.albums.updated++;
      } else {
        result.albums.skipped++;
      }
    } catch {
      result.albums.failed++;
    }
    await sleep(110);
  }

  return NextResponse.json(result);
}
