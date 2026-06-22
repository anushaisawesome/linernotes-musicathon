import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixPinkDiamond() {
  try {
    console.log("[Fix Pink Diamond] Starting...");

    // Find the pink diamond review
    const review = await prisma.review.findFirst({
      where: {
        trackName: "pink diamond",
        trackArtist: { contains: "Charli" },
      },
    });

    if (!review) {
      console.log("[Fix Pink Diamond] Review not found");
      return;
    }

    console.log("[Fix Pink Diamond] Found review:", review.id, review.trackId);

    // Update with real Spotify ID for "Pink Diamond" by Charli XCX
    // Spotify ID: 3yyqqURWcW2jWmBJJJ4jNZ
    await prisma.review.update({
      where: { id: review.id },
      data: {
        trackId: "3yyqqURWcW2jWmBJJJ4jNZ",
        trackAlbum: "BRAT",
        artworkUrl: "https://i.scdn.co/image/ab67616d0000b273e21857dbc5334a7aba9524c4",
      },
    });

    console.log("[Fix Pink Diamond] ✓ Fixed successfully!");
  } catch (error) {
    console.error("[Fix Pink Diamond] Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPinkDiamond();
