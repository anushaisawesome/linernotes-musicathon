/**
 * Centralized Spotify app token cache
 * Prevents rate limiting by reusing tokens across all API endpoints
 */

// Cache Spotify app token (valid for 1 hour)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getSpotifyAppToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  // Get new token
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get Spotify token: ${tokenResponse.status}`);
  }

  const { access_token, expires_in } = await tokenResponse.json();

  // Cache token (expires in 1 hour, refresh 5 minutes early to be safe)
  cachedToken = {
    token: access_token,
    expiresAt: Date.now() + ((expires_in - 300) * 1000),
  };

  console.log('[Spotify Token Cache] New token obtained, expires in', expires_in, 'seconds');

  return access_token;
}
