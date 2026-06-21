#!/usr/bin/env tsx
import { prisma } from '../src/lib/prisma';

async function listReviews() {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        user: {
          select: {
            handle: true,
            displayName: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    console.log(`\nTotal reviews: ${reviews.length}\n`);

    reviews.forEach((r, i) => {
      console.log(`${i + 1}. ${r.trackName} - ${r.trackArtist}`);
      console.log(`   by @${r.user?.handle} (${r.user?.displayName})`);
      console.log(`   rating: ${r.rating} | created: ${r.createdAt.toISOString().split('T')[0]}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listReviews();
