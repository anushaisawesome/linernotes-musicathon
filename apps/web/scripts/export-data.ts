import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env.local") });

import { prisma } from "../src/lib/prisma";

async function exportData() {
  try {
    console.log("Exporting data...");

    const data = {
      users: await prisma.user.findMany({
        include: {
          accounts: true,
          sessions: true,
        },
      }),
      reviews: await prisma.review.findMany({
        include: {
          notes: true,
          likes: true,
          reposts: true,
          saves: true,
        },
      }),
      albumReviews: await prisma.albumReview.findMany({
        include: {
          trackReviews: {
            include: {
              notes: true,
            },
          },
          likes: true,
          reposts: true,
        },
      }),
      playlists: await prisma.playlist.findMany({
        include: {
          tracks: {
            include: {
              notes: true,
            },
          },
        },
      }),
    };

    const exportPath = path.join(process.cwd(), "data-export.json");
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));

    console.log(`✅ Data exported to: ${exportPath}`);
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Reviews: ${data.reviews.length}`);
    console.log(`   Album Reviews: ${data.albumReviews.length}`);
    console.log(`   Playlists: ${data.playlists.length}`);
  } catch (error) {
    console.error("❌ Export failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
