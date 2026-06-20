import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import SpotifyProvider from "next-auth/providers/spotify";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Generate a unique handle from display name or email
 */
function generateHandle(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 15);

  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}${randomSuffix}`;
}

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as any,
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: "https://accounts.spotify.com/authorize?scope=user-read-email+user-read-private",
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
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const email = (credentials.email as string).toLowerCase();

        // Sign up
        if (credentials.action === "signup") {
          if (!credentials.displayName) {
            throw new Error("Display name required for signup");
          }

          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            throw new Error("User with this email already exists");
          }

          // Hash password
          const passwordHash = await bcrypt.hash(credentials.password as string, 10);

          // Create user
          const handle = generateHandle(credentials.displayName as string);
          const user = await prisma.user.create({
            data: {
              email,
              displayName: credentials.displayName as string,
              handle,
              passwordHash,
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatarUrl,
          };
        }

        // Login
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash);

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

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
        // Allow sign in - onboarding will handle missing handle/displayName
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
