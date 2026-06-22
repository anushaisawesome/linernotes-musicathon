import { prisma } from './apps/web/src/lib/prisma';

async function fixReview() {
  // Update the broken review with correct Spotify ID for "pink diamond" by Charli xcx
  const result = await prisma.review.updateMany({
    where: {
      trackId: { startsWith: 'lastfm-pink diamond' },
    },
    data: {
      trackId: '3yyqqURWcW2jWmBJJJ4jNZ', // Spotify ID for pink diamond
      artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2730368b16ac23b61736daab6ef',
      trackAlbum: 'Number 1 Angel',
    },
  });
  
  console.log('Fixed', result.count, 'reviews');
  process.exit(0);
}

fixReview().catch(console.error);
