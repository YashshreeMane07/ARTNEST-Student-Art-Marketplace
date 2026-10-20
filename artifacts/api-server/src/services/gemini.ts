import { GoogleGenAI } from "@google/genai";

export type ArtworkSuggestions = {
  title: string;
  description: string;
  tags: string[];
  category: string;
  keywords: string[];
  priceGuidance: { min: number; max: number; currency: "INR"; rationale: string };
};

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured. Add GEMINI_API_KEY in Replit Secrets.");
  return new GoogleGenAI({ apiKey });
}

export async function suggestArtworkMetadata(input: {
  title?: string;
  description?: string;
  category?: string;
  mimeType?: string;
  image?: Buffer;
}): Promise<ArtworkSuggestions> {
  const imagePart =
    input.image && input.mimeType
      ? [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.image.toString("base64"),
            },
          },
        ]
      : [];
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Suggest marketplace metadata for a student creator's original digital artwork.",
              "Return JSON only with title, description, tags (array of 3-8 strings), category, keywords (array of strings), and priceGuidance {min,max,currency:'INR',rationale}.",
              "Keep descriptions accurate and avoid claiming facts that are not visible or supplied.",
              "Price guidance must be a reasonable estimate in Indian rupees, not a promise.",
              `Creator title: ${input.title || "(not supplied)"}`,
              `Creator description: ${input.description || "(not supplied)"}`,
              `Creator category: ${input.category || "(not supplied)"}`,
            ].join("\n"),
          },
          ...imagePart,
        ],
      },
    ],
    config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned no artwork suggestions.");

  const parsed = JSON.parse(text) as ArtworkSuggestions;
  if (
    typeof parsed.title !== "string" ||
    typeof parsed.description !== "string" ||
    !Array.isArray(parsed.tags) ||
    typeof parsed.category !== "string" ||
    !Array.isArray(parsed.keywords) ||
    !parsed.priceGuidance ||
    !Number.isFinite(parsed.priceGuidance.min) ||
    !Number.isFinite(parsed.priceGuidance.max)
  ) {
    throw new Error("Gemini returned an invalid suggestion format.");
  }
  return {
    ...parsed,
    tags: parsed.tags.slice(0, 8).map((tag) => String(tag).slice(0, 40)),
    keywords: parsed.keywords.slice(0, 12).map((keyword) => String(keyword).slice(0, 60)),
    priceGuidance: {
      min: Math.max(0, Math.round(parsed.priceGuidance.min)),
      max: Math.max(0, Math.round(parsed.priceGuidance.max)),
      currency: "INR",
      rationale: String(parsed.priceGuidance.rationale || "").slice(0, 500),
    },
  };
}
