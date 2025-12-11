import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });

    const body = req.body;

    await redis.set(body.userId, body);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    return res.status(500).json({ error: "Save failed" });
  }
}
