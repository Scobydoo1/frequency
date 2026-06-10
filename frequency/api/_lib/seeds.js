/* Curated fallback messages keyed by prompt id, derived from the shared
 * canonical content so frontend and backend never drift. */
import { PROMPTS } from "../../shared/prompts.js";

export const SEEDS = Object.fromEntries(PROMPTS.map((p) => [p.id, p.messages]));
