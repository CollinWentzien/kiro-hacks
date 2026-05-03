/**
 * visionPrompt.js — Vision model prompt for ecosystem image analysis
 *
 * Tuned for moondream, which reads the user prompt directly and does not
 * reliably honour a separate system prompt. The JSON schema and rules are
 * embedded in the user prompt so moondream sees them alongside the image.
 *
 * Backend only. Never import from frontend code.
 */

/**
 * System prompt — kept short for moondream compatibility.
 * The full schema lives in buildVisionUserPrompt() below.
 */
export const VISION_SYSTEM_PROMPT =
  'You are an ecosystem image analysis assistant. Always respond with valid JSON only.';

/**
 * User prompt sent alongside the image.
 * Contains the full schema and rules so moondream sees them in context.
 * @returns {string}
 */
export function buildVisionUserPrompt() {
  return `Analyze this image and identify the main visible subject (plant, animal, insect, fungus, soil, fish, water feature, or ecosystem element).

You MUST respond with ONLY a valid JSON object. No prose, no explanation, no markdown — just the JSON.

Use exactly this schema:
{
  "category": "plant",
  "common_name": "Tomato Plant",
  "scientific_name": "Solanum lycopersicum",
  "confidence": 82,
  "health_status": "Mild leaf stress",
  "ecosystem_role": "Food-producing plant that can attract pollinators.",
  "insights": ["Leaves may show watering inconsistency.", "Plant appears mostly healthy."],
  "recommendations": ["Check soil moisture.", "Inspect for pests."],
  "warning": ""
}

Rules:
- category: one of plant, animal, insect, fungus, fish, soil, water, ecosystem, unknown
- confidence: integer 0–100
- health_status: short phrase like "Healthy", "Mild stress", "Signs of disease", "Unknown"
- ecosystem_role: one sentence
- insights: array of 2–4 short strings
- recommendations: array of 2–3 short strings
- warning: non-empty only if subject may be poisonous, dangerous, invasive, or diseased
- If uncertain, lower confidence and say so in common_name
- Do NOT invent facts you cannot see in the image
- Respond with JSON only — no other text`;
}
