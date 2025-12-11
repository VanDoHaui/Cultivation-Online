import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.UPSTASH_REDIS_URL);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const raw = await redis.get(`chapters:${userId}`);
    const chapters = raw ? JSON.parse(raw) : [];

    return NextResponse.json({ chapters });
  } catch (err) {
    console.error("LOAD ERROR:", err);
    return NextResponse.json(
      { error: "Failed to load" },
      { status: 500 }
    );
  }
}
