import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/check-email?email=... - Whether an account already exists.
 * Used by signup to show a clear "already exists" message (NextAuth masks the
 * credentials authorize error as a generic "Configuration").
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.json({ exists: false });
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    return NextResponse.json({ exists: !!user });
  } catch {
    // Never block signup on a check failure.
    return NextResponse.json({ exists: false });
  }
}
