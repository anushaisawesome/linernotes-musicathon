import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sign } from 'jsonwebtoken';

/**
 * Mobile Spotify OAuth endpoint
 * Exchanges Spotify authorization code for user info and returns JWT for mobile app
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    console.log('[Mobile Spotify Auth] Request received:', {
      hasCode: !!code,
      codePreview: code?.substring(0, 20),
    });

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'com.musicathonln.app://callback',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Spotify token exchange failed:', error);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 401 }
      );
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    // Get user info from Spotify
    const userInfoResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to fetch Spotify user info');
      return NextResponse.json(
        { error: 'Failed to fetch user info from Spotify' },
        { status: 401 }
      );
    }

    const spotifyUser = await userInfoResponse.json();

    if (!spotifyUser.email) {
      return NextResponse.json(
        { error: 'No email found in Spotify account. Please ensure email permission is granted.' },
        { status: 400 }
      );
    }

    const email = spotifyUser.email;
    const name = spotifyUser.display_name;
    const picture = spotifyUser.images?.[0]?.url;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Generate unique handle from Spotify username or email
      const baseHandle = (spotifyUser.id || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const handle = `${baseHandle}${randomSuffix}`;

      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          displayName: name || email.split('@')[0],
          handle,
          image: picture,
        },
      });
    }

    // Generate JWT token for mobile
    const jwtToken = sign(
      { sub: user.id, email: user.email },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.displayName,
        name: user.name,
        avatarUrl: user.image,
      },
      token: jwtToken,
    });
  } catch (error) {
    console.error('Mobile Spotify login error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate with Spotify' },
      { status: 401 }
    );
  }
}
