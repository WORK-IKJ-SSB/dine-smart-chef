import { createServerFn } from "@tanstack/react-start";

export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { stats: { totalOrders: number; totalRevenue: number; topItems: { name: string; qty: number; revenue: number }[]; byHour: { hour: number; orders: number }[] } }) => input,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `You are a restaurant operations analyst. Given today's sales data, write 3 concise, actionable insights (max 2 sentences each). Be specific and reference numbers. Return plain markdown bullet list, no preamble.\n\nData:\n${JSON.stringify(data.stats, null, 2)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a sharp, concise restaurant analytics assistant." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { insights: `Could not generate insights (${res.status}). ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { insights: json.choices?.[0]?.message?.content ?? "No insights available." };
  });