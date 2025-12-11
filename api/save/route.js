import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.UPSTASH_REDIS_URL);

export async function POST(req) {
  try {
    const { userId, chapters } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await redis.set(`chapters:${userId}`, JSON.stringify(chapters));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 }
    );
  }
}
