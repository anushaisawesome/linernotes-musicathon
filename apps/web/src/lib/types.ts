// THE DATA CONTRACT — everyone imports, only Abia edits

import type { Palette } from "@/lib/palette";

export type Note = {
  id: string;
  seconds: number;
  label: string;
  note?: string; // Optional longer commentary
  lyric?: string; // Bookmarked lyric line (if this note is a lyric annotation)
  createdAt: string;
};

export type Moment = {
  seconds: number;
  label?: string;
};

export type User = {
  id: string;
  handle: string;
  displayName: string;
  name?: string | null; // NextAuth display name (from the OAuth profile)
  avatarUrl?: string;
};

export type Track = {
  trackId: string;
  name: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl?: string;
  genre?: string;
  palette?: Palette;
};

export type Album = {
  albumId: string;
  name: string;
  artist: string;
  artworkUrl: string;
  releaseDate?: string;
  totalTracks?: number;
  tracks?: Track[]; // Full track listing if available
};

export type Reaction = "flame" | "love" | "skip";

export type Review = {
  id: string;
  userId: string;
  user?: User;
  track: Track;
  rating: number; // 0.5–5.0 in 0.5 steps
  take?: string; // one short line
  moment?: Moment; // DEPRECATED: Use notes[0] or featuredNote instead
  notes?: Note[]; // Multiple timestamped notes
  featuredNoteId?: string; // Which note to show on share card
  // Album review fields (when part of an album review)
  albumReviewId?: string;
  trackNumber?: number;
  reaction?: Reaction; // For mobile sharing (flame/love/skip)
  createdAt: string; // ISO
  likeCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  saveCount?: number;
  saved?: boolean;
};

export type AlbumReview = {
  id: string;
  userId: string;
  user?: User;
  album: Album;
  overallRating?: number; // Manual or auto-calculated
  take?: string; // Review of album as a whole
  trackReviews?: Review[]; // Individual track reviews
  createdAt: string; // ISO
  likeCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  saveCount?: number;
  saved?: boolean;
};

export type PlaylistTrack = {
  id: string;
  trackId: string;
  name: string;
  artist: string;
  artworkUrl: string;
  note?: string; // Why this track is in the playlist
  order: number;
};

export type Playlist = {
  id: string;
  userId: string;
  user?: User;
  title: string;
  description?: string; // The story/theme of the playlist
  tracks: PlaylistTrack[];
  createdAt: string; // ISO
  likeCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  saveCount?: number;
  saved?: boolean;
};

export type FeedItem = {
  kind: "review" | "repost";
  review: Review;
  repostedBy?: User;
  at: string;
};

export type AlbumFeedItem = {
  kind: "album_review" | "album_repost";
  albumReview: AlbumReview;
  repostedBy?: User;
  at: string;
};

export type PlaylistFeedItem = {
  kind: "playlist" | "playlist_repost";
  playlist: Playlist;
  repostedBy?: User;
  at: string;
};

export type UnifiedFeedItem = FeedItem | AlbumFeedItem | PlaylistFeedItem;

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted";
};
