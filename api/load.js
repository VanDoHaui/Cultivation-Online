import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });

    const userId = req.query.userId;
    const data = await redis.get(userId);

    return res.status(200).json(data || {});
  } catch (err) {
    console.error("LOAD ERROR:", err);
    return res.status(500).json({ error: "Load failed" });
  }
}
