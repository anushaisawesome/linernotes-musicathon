import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import SpotifyProvider from "next-auth/providers/spotify";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as any,
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: "https://accounts.spotify.com/authorize?scope=user-read-email+user-read-private+streaming+user-read-playback-state+user-modify-playback-state",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        action: { label: "Action", type: "text" }, // "login" or "signup"
        displayName: { label: "Display Name", type: "text" },
      },
      async authorize(credentials): Promise<any> {
        console.log("[Auth] Credentials received:", {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
          action: credentials?.action,
          hasDisplayName: !!credentials?.displayName,
        });

        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const email = (credentials.email as string).toLowerCase();

        // Sign up
        if (credentials.action === "signup") {
          console.log("[Auth] Entering signup flow");

          if (!credentials.displayName) {
            console.log("[Auth] Signup failed: Display name missing");
            throw new Error("Display name required for signup");
          }

          // Check if user already exists
          console.log("[Auth] Checking if user exists:", email);
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            console.log("[Auth] Signup failed: User already exists");
            throw new Error("User with this email already exists");
          }

          // Hash password
          console.log("[Auth] Creating new user");
          const passwordHash = await bcrypt.hash(credentials.password as string, 10);

          // Create the user WITHOUT a handle — they pick it in onboarding, so it's
          // kept exactly as typed (no random suffix). A null handle also means the
          // onboarding gate won't bounce them home before they choose one.
          const user = await prisma.user.create({
            data: {
              email,
              displayName: credentials.displayName as string,
              passwordHash,
            },
          });

          console.log("[Auth] User created successfully:", user.id);

          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatarUrl,
          };
        }

        // Login
        console.log("[Auth] Entering login flow for:", email);
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          console.log("[Auth] Login failed: User not found or no password");
          throw new Error("Invalid email or password");
        }

        console.log("[Auth] User found, verifying password");
        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash);

        if (!isValid) {
          console.log("[Auth] Login failed: Invalid password");
          throw new Error("Invalid email or password");
        }

        console.log("[Auth] Login successful:", user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login", // Error code passed in query string as ?error=
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // For existing Spotify users, update their token
        if (account?.provider === "spotify" && account.access_token && user.id) {
          const existingConnection = await prisma.musicConnection.findFirst({
            where: {
              userId: user.id,
              service: "spotify",
            },
          });

          // Only update existing connections here
          // New connections are created in the createUser event
          if (existingConnection) {
            await prisma.musicConnection.update({
              where: { id: existingConnection.id },
              data: {
                accessToken: account.access_token,
                refreshToken: account.refresh_token || existingConnection.refreshToken,
                expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
              },
            });
            console.log("[Auth] Updated MusicConnection for Spotify login");
          }
        }

        return true;
      } catch (error) {
        console.error("SignIn callback error:", error);
        return false;
      }
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;

        // Fetch full user data including handle
        const user = await prisma.user.findUnique({
          where: { id: token.sub! },
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        });

        if (user) {
          session.user.handle = user.handle || undefined;
          session.user.displayName = user.displayName || undefined;
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      try {
        // New Spotify users will complete onboarding to set their handle
        // Don't auto-generate handle here - let them choose in onboarding
        console.log("New user created:", user.id);
      } catch (error) {
        console.error("CreateUser event error:", error);
      }
    },
  },
};

/**
 * Export NextAuth instance for server-side usage
 */
const nextAuthInstance = NextAuth(authOptions);

export const { auth, signIn, signOut, handlers } = nextAuthInstance;
