import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Find the pink diamond review
    const review = await prisma.review.findFirst({
      where: {
        trackName: "pink diamond",
        trackArtist: { contains: "Charli" },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Pink diamond review not found" }, { status: 404 });
    }

    console.log("[Fix Pink Diamond] Found review:", review.id, review.trackId);

    // Update with real Spotify ID for "Pink Diamond" by Charli XCX
    // From album "how i'm feeling now" (2020)
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: {
        trackId: "3V0PgcsUMlAGXwCD0084pY",
        trackAlbum: "how i'm feeling now",
        artworkUrl: "https://i.scdn.co/image/ab67616d0000b273d3aaeb5f5fb6fc4a2c104088",
      },
    });

    console.log("[Fix Pink Diamond] ✓ Fixed successfully!");

    return NextResponse.json({
      message: "Pink diamond review fixed!",
      oldId: review.trackId,
      newId: updated.trackId,
    });
  } catch (error) {
    console.error("[Fix Pink Diamond] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix review" },
      { status: 500 }
    );
  }
}
