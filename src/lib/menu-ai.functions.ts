import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY missing");
  return k;
}

/** Parse a photo of a paper menu into structured items. */
export const parseMenuImage = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string }) => input)
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'You extract restaurant menu items from a photo. Respond with ONLY valid JSON, no markdown, no commentary. Schema: {"items":[{"name":"string","price":number,"category":"Starter|Main|Dessert|Drink|Side"}]}. If you cannot read a price, use 0. Map similar categories to the closest of the listed ones.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every dish from this menu photo." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Vision parse failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: { items?: { name: string; price: number; category: string }[] };
    try { parsed = JSON.parse(cleaned); } catch { parsed = { items: [] }; }
    return { items: parsed.items ?? [] };
  });

/** Generate a square dish photo and return it as a base64 data URL. */
export const generateDishImage = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const prompt = `A beautiful overhead food photograph of "${data.name}", restaurant plating on a neutral wooden table, soft natural light, appetizing, high detail.`;
    const res = await fetch(`${GATEWAY}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Image gen failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    return { dataUrl: `data:image/png;base64,${b64}` };
  });