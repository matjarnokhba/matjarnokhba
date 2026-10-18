import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const url = new URL(request.url);
  const origin = url.origin;

  if (!clientId) {
    return NextResponse.json({ error: "Google Client ID is missing" }, { status: 500 });
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  const scope = "openid email profile";

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(googleAuthUrl);
}