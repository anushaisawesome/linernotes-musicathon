import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reviews - Get user's reviews or public feed
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const feedType = searchParams.get("feed"); // "friends" or null
    const reviewType = searchParams.get("type"); // "reposts" or "saved" or null

    // Public feed - show all reviews for hackathon demo
    if (feedType === "friends") {
      // No auth required - fully public feed for judges and demo
      const reviews = await prisma.review.findMany({
        where: {
          albumReviewId: null, // exclude per-track reviews that belong to an album
        },
        include: {
          user: true,
          likes: true,
          saves: true,
          reposts: {
            include: { user: true },
          },
          notes: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { likes: true, reposts: true, saves: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Transform to match expected types
      const transformedReviews = reviews.map((review) => ({
        id: review.id,
        userId: review.userId,
        user: review.user,
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
        moment: review.momentSeconds !== null && review.momentSeconds !== undefined ? {
          seconds: review.momentSeconds,
          label: review.momentLabel || undefined,
        } : undefined,
        notes: review.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
          createdAt: note.createdAt.toISOString(),
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
        likeCount: review._count.likes,
        repostCount: review._count.reposts,
        likedByMe: currentUserId ? review.likes.some((l) => l.userId === currentUserId) : false,
        repostedByMe: currentUserId ? review.reposts.some((r) => r.userId === currentUserId) : false,
        saveCount: review._count.saves,
        saved: currentUserId ? review.saves.some((s) => s.userId === currentUserId) : false,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Reposts - reviews the current user has reposted
    if (reviewType === "reposts") {
      if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const reposts = await prisma.repost.findMany({
        where: { userId: currentUserId },
        include: {
          review: {
            include: {
              user: true,
              likes: true,
              reposts: {
                include: { user: true },
              },
              notes: {
                orderBy: { createdAt: 'asc' },
              },
              _count: {
                select: { likes: true, reposts: true, saves: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const transformedReviews = reposts.map(({ review }) => ({
        id: review.id,
        userId: review.userId,
        user: review.user,
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
        momentSeconds: review.momentSeconds || undefined,
        momentLabel: review.momentLabel || undefined,
        notes: review.notes.map((note) => ({
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
        likeCount: review._count.likes,
        repostCount: review._count.reposts,
        likedByMe: currentUserId ? review.likes.some((l) => l.userId === currentUserId) : false,
        repostedByMe: currentUserId ? review.reposts.some((r) => r.userId === currentUserId) : false,
        saveCount: review._count.saves,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Saved reviews - reviews the current user has saved
    if (reviewType === "saved") {
      if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const saves = await prisma.save.findMany({
        where: { userId: currentUserId },
        include: {
          review: {
            include: {
              user: true,
              likes: true,
              reposts: {
                include: { user: true },
              },
              notes: {
                orderBy: { createdAt: 'asc' },
              },
              _count: {
                select: { likes: true, reposts: true, saves: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const transformedReviews = saves.map(({ review }) => ({
        id: review.id,
        userId: review.userId,
        user: review.user,
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
        momentSeconds: review.momentSeconds || undefined,
        momentLabel: review.momentLabel || undefined,
        notes: review.notes.map((note) => ({
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
        likeCount: review._count.likes,
        repostCount: review._count.reposts,
        likedByMe: currentUserId ? review.likes.some((l) => l.userId === currentUserId) : false,
        repostedByMe: currentUserId ? review.reposts.some((r) => r.userId === currentUserId) : false,
        saveCount: review._count.saves,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Get specific user's reviews (public, no auth required if userId provided)
    if (userId) {
      const reviews = await prisma.review.findMany({
        where: { userId, albumReviewId: null }, // exclude per-track reviews within an album
        include: {
          user: true,
          likes: true,
          reposts: true,
          notes: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { likes: true, reposts: true, saves: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Transform to match expected types
      const transformedReviews = reviews.map((review) => ({
        id: review.id,
        userId: review.userId,
        user: review.user,
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
        moment: review.momentSeconds !== null && review.momentSeconds !== undefined ? {
          seconds: review.momentSeconds,
          label: review.momentLabel || undefined,
        } : undefined,
        notes: review.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
          createdAt: note.createdAt.toISOString(),
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
        likeCount: review._count.likes,
        repostCount: review._count.reposts,
        likedByMe: currentUserId ? review.likes.some((l) => l.userId === currentUserId) : false,
        repostedByMe: currentUserId ? review.reposts.some((r) => r.userId === currentUserId) : false,
        saveCount: review._count.saves,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Get current user's reviews (requires auth)
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviews = await prisma.review.findMany({
      where: { userId: currentUserId, albumReviewId: null }, // exclude per-track reviews within an album
      include: {
        user: true,
        likes: true,
        reposts: true,
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true, saves: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to match expected types
    const transformedReviews = reviews.map((review) => ({
      id: review.id,
      userId: review.userId,
      user: review.user,
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
      moment: review.momentSeconds !== null && review.momentSeconds !== undefined ? {
        seconds: review.momentSeconds,
        label: review.momentLabel || undefined,
      } : undefined,
      notes: review.notes.map(note => ({
        id: note.id,
        seconds: note.seconds,
        label: note.label,
        note: note.note || undefined,
        createdAt: note.createdAt.toISOString(),
      })),
      featuredNoteId: review.featuredNoteId || undefined,
      createdAt: review.createdAt.toISOString(),
      likeCount: review._count.likes,
      repostCount: review._count.reposts,
      likedByMe: currentUserId ? review.likes.some((l) => l.userId === currentUserId) : false,
      repostedByMe: currentUserId ? review.reposts.some((r) => r.userId === currentUserId) : false,
      saveCount: review._count.saves,
    }));

    return NextResponse.json({ reviews: transformedReviews });
  } catch (error) {
    console.error("Get reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews - Create a new review
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      trackId,
      trackName,
      trackArtist,
      trackAlbum,
      artworkUrl,
      previewUrl,
      rating,
      take,
      momentSeconds, // DEPRECATED: for backward compatibility
      momentLabel,   // DEPRECATED: for backward compatibility
      notes,         // Array of { seconds, label, note? }
    } = body;

    // Validate required fields. Album + artwork are optional — singles/remixes
    // often have neither, and search sources (esp. MusicBrainz) may omit them.
    if (
      !trackId ||
      !trackName ||
      !trackArtist ||
      rating === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating < 0.5 || rating > 5.0) {
      return NextResponse.json(
        { error: "Rating must be between 0.5 and 5.0" },
        { status: 400 }
      );
    }

    // Look up Spotify ID if track is from iTunes/MusicBrainz/Last.fm
    let finalTrackId = trackId;
    let finalArtworkUrl = artworkUrl || '';
    let finalAlbum = trackAlbum || '';

    // Check if trackId is NOT a Spotify ID (Spotify IDs are 22-char alphanumeric)
    const isSpotifyId = /^[a-zA-Z0-9]{22}$/.test(trackId);

    if (!isSpotifyId) {
      console.log("[Reviews] Looking up Spotify ID for non-Spotify track:", trackId);
      try {
        // Use app credentials for reliable lookup
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (clientId && clientSecret) {
          // Get app token
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
            const query = encodeURIComponent(`track:${trackName} artist:${trackArtist}`);
            const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
            const searchResponse = await fetch(searchUrl, {
              headers: { Authorization: `Bearer ${access_token}` },
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const spotifyTrack = searchData.tracks?.items?.[0];

              if (spotifyTrack) {
                finalTrackId = spotifyTrack.id;
                const images = spotifyTrack.album.images || [];
                finalArtworkUrl = images.find((img: any) => img.width >= 640)?.url || images[0]?.url || finalArtworkUrl;
                finalAlbum = spotifyTrack.album.name || finalAlbum;
                console.log("[Reviews] Found Spotify ID:", finalTrackId);
              } else {
                console.warn("[Reviews] No Spotify match found, storing original ID:", trackId);
              }
            }
          }
        }
      } catch (error) {
        console.error("[Reviews] Spotify lookup failed, using original track data:", error);
      }
    }

    // Create review with notes
    const review = await prisma.review.create({
      data: {
        userId: currentUserId,
        trackId: finalTrackId,
        trackName,
        trackArtist,
        // Columns are non-null; default to '' when album/artwork are absent.
        trackAlbum: finalAlbum,
        artworkUrl: finalArtworkUrl,
        previewUrl,
        rating,
        take: take || null,
        // Keep deprecated fields for backward compatibility
        momentSeconds: momentSeconds ?? null,
        momentLabel: momentLabel ?? null,
        // Create notes if provided
        notes: notes && notes.length > 0 ? {
          create: notes.map((note: any) => ({
            seconds: note.seconds,
            label: note.label,
            note: note.note || null,
            lyric: note.lyric || null,
          })),
        } : undefined,
      },
      include: {
        user: true,
        notes: true,
        _count: {
          select: { likes: true, reposts: true, saves: true },
        },
      },
    });

    // Feature the first submitted note (the composer puts the author's chosen
    // moment first). Prisma's include order isn't guaranteed, so match the
    // created row by content rather than trusting review.notes[0].
    if (review.notes && review.notes.length > 0 && !review.featuredNoteId) {
      const want = notes[0];
      const match =
        review.notes.find(
          (n) =>
            n.seconds === want.seconds &&
            (n.label || null) === (want.label ?? null) &&
            (n.note || null) === (want.note || null) &&
            (n.lyric || null) === (want.lyric || null)
        ) || review.notes[0];
      await prisma.review.update({
        where: { id: review.id },
        data: { featuredNoteId: match.id },
      });
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
