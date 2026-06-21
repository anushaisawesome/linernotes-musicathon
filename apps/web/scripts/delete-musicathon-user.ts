#!/usr/bin/env tsx
/**
 * Delete the musicathon demo user and all their reviews
 */

import { prisma } from '../src/lib/prisma';

async function deleteMusicathonUser() {
  console.log('🗑️  Deleting musicathon demo user and reviews...\n');

  try {
    const user = await prisma.user.findUnique({
      where: { handle: 'musicathon' },
      include: {
        reviews: true,
      }
    });

    if (!user) {
      console.log('No musicathon user found - nothing to delete');
      return;
    }

    console.log(`Found @musicathon with ${user.reviews.length} reviews\n`);

    // Delete user (cascade will delete all reviews, notes, etc.)
    await prisma.user.delete({
      where: { handle: 'musicathon' }
    });

    console.log(`✓ Deleted @musicathon and all ${user.reviews.length} reviews`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteMusicathonUser();
