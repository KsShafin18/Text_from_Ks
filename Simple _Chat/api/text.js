const TEXT_KEY = "textfromks:latest";
const MAX_TEXT_LENGTH = 10000;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    console.error("Upstash Redis environment variables are not configured.");
    return res.status(500).json({ error: "Server storage is not configured." });
  }

  let command;
  if (req.method === "GET") {
    command = ["GET", TEXT_KEY];
  } else {
    const text = req.body && typeof req.body === "object" ? req.body.text : undefined;
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "লেখা খালি রাখা যাবে না।" });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: "লেখা ১০,০০০ অক্ষরের মধ্যে রাখুন।" });
    }
    command = ["SET", TEXT_KEY, text];
  }

  try {
    const response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      console.error("Upstash Redis request failed:", result.error || response.status);
      return res.status(502).json({ error: "Storage service থেকে উত্তর পাওয়া যায়নি।" });
    }

    return res.status(200).json({ text: req.method === "GET" ? result.result || "" : "" });
  } catch (error) {
    console.error("Upstash Redis request failed:", error);
    return res.status(502).json({ error: "Storage service-এ সংযোগ করা যায়নি।" });
  }
};
