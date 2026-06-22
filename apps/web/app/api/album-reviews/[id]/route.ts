import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/album-reviews/[id] - Get a single album review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
      include: {
        user: true,
        trackReviews: {
          include: {
            notes: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { trackNumber: 'asc' },
        },
        likes: true,
        reposts: true,
        saves: true,
        _count: {
          select: { likes: true, reposts: true, saves: true },
        },
      },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    // Transform to match expected types
    const transformedAlbumReview = {
      id: albumReview.id,
      userId: albumReview.userId,
      user: albumReview.user,
      album: {
        albumId: albumReview.albumId,
        name: albumReview.albumName,
        artist: albumReview.albumArtist,
        artworkUrl: albumReview.artworkUrl,
        releaseDate: albumReview.releaseDate || undefined,
        totalTracks: albumReview.totalTracks || undefined,
      },
      overallRating: albumReview.overallRating || undefined,
      take: albumReview.take || undefined,
      trackReviews: albumReview.trackReviews.map(review => ({
        id: review.id,
        userId: review.userId,
        user: albumReview.user, // Inherit album reviewer as track review author
        track: {
          trackId: review.trackId,
          name: review.trackName,
          artist: review.trackArtist,
          album: review.trackAlbum,
          artworkUrl: review.artworkUrl,
          previewUrl: review.previewUrl || undefined,
        },
        rating: review.rating,
        take: review.take || undefined,
        reaction: review.reaction || undefined,
        trackNumber: review.trackNumber || undefined,
        notes: review.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
          lyric: note.lyric || undefined,
          createdAt: note.createdAt.toISOString(),
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
      })),
      createdAt: albumReview.createdAt.toISOString(),
      likeCount: albumReview._count.likes,
      repostCount: albumReview._count.reposts,
      saveCount: albumReview._count.saves,
      likedByMe: currentUserId ? albumReview.likes.some((l) => l.userId === currentUserId) : false,
      repostedByMe: currentUserId ? albumReview.reposts.some((r) => r.userId === currentUserId) : false,
      saved: currentUserId ? albumReview.saves.some((s) => s.userId === currentUserId) : false,
    };

    return NextResponse.json({ albumReview: transformedAlbumReview });
  } catch (error) {
    console.error("Get album review error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album review" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/album-reviews/[id] - Update an album review
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { overallRating, take, trackReviews } = body;

    // Check if album review exists and belongs to user
    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
      include: { trackReviews: true },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    if (albumReview.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate overall rating if provided
    if (overallRating !== undefined && overallRating !== null && (overallRating < 0.5 || overallRating > 5.0)) {
      return NextResponse.json(
        { error: "Overall rating must be between 0.5 and 5.0" },
        { status: 400 }
      );
    }

    // Get Spotify token for track ID lookups if needed
    let spotifyToken: string | null = null;
    const needsLookup = trackReviews && trackReviews.some((tr: any) => !(/^[a-zA-Z0-9]{22}$/.test(tr.trackId)));

    if (needsLookup) {
      try {
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: 'grant_type=client_credentials',
          });

          if (tokenResponse.ok) {
            const { access_token } = await tokenResponse.json();
            spotifyToken = access_token;
          }
        }
      } catch (error) {
        console.error("[Album Reviews PATCH] Failed to get Spotify token:", error);
      }
    }

    // Process track reviews if provided
    if (trackReviews && Array.isArray(trackReviews)) {
      // Delete all existing track reviews (cascade will delete notes)
      await prisma.review.deleteMany({
        where: { albumReviewId: id },
      });

      // Create new track reviews
      if (trackReviews.length > 0) {
        const finalTrackReviews = await Promise.all(
          trackReviews.map(async (tr: any) => {
            let finalTrackId = tr.trackId;
            const isTrackSpotifyId = /^[a-zA-Z0-9]{22}$/.test(tr.trackId);

            if (!isTrackSpotifyId && spotifyToken) {
              try {
                const query = encodeURIComponent(`track:${tr.trackName} artist:${tr.trackArtist}`);
                const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
                const searchResponse = await fetch(searchUrl, {
                  headers: { Authorization: `Bearer ${spotifyToken}` },
                });

                if (searchResponse.ok) {
                  const searchData = await searchResponse.json();
                  const spotifyTrack = searchData.tracks?.items?.[0];
                  if (spotifyTrack) {
                    finalTrackId = spotifyTrack.id;
                  }
                }
              } catch (error) {
                console.error("[Album Reviews PATCH] Spotify track lookup failed:", error);
              }
            }

            return {
              userId: currentUserId,
              trackId: finalTrackId,
              trackName: tr.trackName,
              trackArtist: tr.trackArtist,
              trackAlbum: albumReview.albumName,
              artworkUrl: tr.artworkUrl || albumReview.artworkUrl,
              previewUrl: tr.previewUrl || null,
              rating: tr.rating,
              take: tr.take || null,
              reaction: tr.reaction || null,
              trackNumber: tr.trackNumber,
              notes: tr.notes && tr.notes.length > 0 ? {
                create: tr.notes.map((note: any) => ({
                  seconds: note.seconds,
                  label: note.label,
                  note: note.note || null,
                  lyric: note.lyric || null,
                })),
              } : undefined,
            };
          })
        );

        await prisma.review.createMany({
          data: finalTrackReviews.map((tr: any) => ({
            userId: tr.userId,
            trackId: tr.trackId,
            trackName: tr.trackName,
            trackArtist: tr.trackArtist,
            trackAlbum: tr.trackAlbum,
            artworkUrl: tr.artworkUrl,
            previewUrl: tr.previewUrl,
            rating: tr.rating,
            take: tr.take,
            reaction: tr.reaction,
            trackNumber: tr.trackNumber,
            albumReviewId: id,
          })),
        });

        // Create notes for each track review
        for (const tr of finalTrackReviews) {
          if (tr.notes?.create && tr.notes.create.length > 0) {
            const trackReview = await prisma.review.findFirst({
              where: {
                albumReviewId: id,
                trackId: tr.trackId,
                trackNumber: tr.trackNumber,
              },
            });
            if (trackReview) {
              await prisma.note.createMany({
                data: tr.notes.create.map((note: any) => ({
                  ...note,
                  reviewId: trackReview.id,
                })),
              });

              // Set featured note for the first note
              const firstNote = await prisma.note.findFirst({
                where: { reviewId: trackReview.id },
                orderBy: { createdAt: 'asc' },
              });
              if (firstNote) {
                await prisma.review.update({
                  where: { id: trackReview.id },
                  data: { featuredNoteId: firstNote.id },
                });
              }
            }
          }
        }
      }
    }

    // Update album review
    const updatedAlbumReview = await prisma.albumReview.update({
      where: { id },
      data: {
        overallRating: overallRating ?? albumReview.overallRating,
        take: take !== undefined ? take : albumReview.take,
      },
      include: {
        user: true,
        trackReviews: {
          include: {
            notes: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { trackNumber: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true },
        },
      },
    });

    // Transform to match expected types
    const transformedAlbumReview = {
      id: updatedAlbumReview.id,
      userId: updatedAlbumReview.userId,
      user: updatedAlbumReview.user,
      album: {
        albumId: updatedAlbumReview.albumId,
        name: updatedAlbumReview.albumName,
        artist: updatedAlbumReview.albumArtist,
        artworkUrl: updatedAlbumReview.artworkUrl,
        releaseDate: updatedAlbumReview.releaseDate || undefined,
        totalTracks: updatedAlbumReview.totalTracks || undefined,
      },
      overallRating: updatedAlbumReview.overallRating || undefined,
      take: updatedAlbumReview.take || undefined,
      trackReviews: updatedAlbumReview.trackReviews.map(review => ({
        id: review.id,
        userId: review.userId,
        user: updatedAlbumReview.user, // Inherit album reviewer as track review author
        track: {
          trackId: review.trackId,
          name: review.trackName,
          artist: review.trackArtist,
          album: review.trackAlbum,
          artworkUrl: review.artworkUrl,
          previewUrl: review.previewUrl || undefined,
        },
        rating: review.rating,
        take: review.take || undefined,
        reaction: review.reaction || undefined,
        trackNumber: review.trackNumber || undefined,
        notes: review.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
          lyric: note.lyric || undefined,
          createdAt: note.createdAt.toISOString(),
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
      })),
      createdAt: updatedAlbumReview.createdAt.toISOString(),
      likeCount: updatedAlbumReview._count.likes,
      repostCount: updatedAlbumReview._count.reposts,
    };

    return NextResponse.json({ albumReview: transformedAlbumReview });
  } catch (error) {
    console.error("Update album review error:", error);
    return NextResponse.json(
      { error: "Failed to update album review" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/album-reviews/[id] - Delete an album review
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if album review exists and belongs to user
    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    if (albumReview.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete album review (track reviews, likes, and reposts will cascade)
    await prisma.albumReview.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete album review error:", error);
    return NextResponse.json(
      { error: "Failed to delete album review" },
      { status: 500 }
    );
  }
}
