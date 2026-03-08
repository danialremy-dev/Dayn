/**
 * Vercel serverless function: generate a short daily insight using OpenAI.
 * Set OPENAI_API_KEY in Vercel project Environment Variables.
 * Prompt focuses on lifestyle, financial, and spiritual motivation.
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY not configured",
      hint: "Add OPENAI_API_KEY in Vercel Project Settings → Environment Variables",
    });
  }

  const systemPrompt = `You are a gentle, uplifting coach. Generate exactly one short paragraph (2–3 sentences) as a daily insight. Touch on: improving daily habits and lifestyle, wise financial choices, and inner peace or spiritual clarity. Be concise, warm, and actionable. No bullet points or titles—just flowing text.`;
  const userPrompt = `Generate today's daily insight for someone who wants to improve their lifestyle, finances, and spiritual wellbeing.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 120,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error", response.status, errText);
      return res.status(response.status).json({
        error: "AI service error",
        details: response.status === 401 ? "Invalid API key" : errText.slice(0, 200),
      });
    }

    const data = await response.json();
    const text =
      data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content.trim()
        : "";
    if (!text) return res.status(500).json({ error: "Empty response from AI" });
    return res.status(200).json({ insight: text });
  } catch (e) {
    console.error("generate-insight error", e);
    return res.status(500).json({ error: "Failed to generate insight", details: e.message });
  }
};
