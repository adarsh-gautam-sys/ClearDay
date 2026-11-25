import { CostTierSchema, ImpactCategorySchema } from "../schemas";

const IMPACT_CATEGORY_VALUES = [...ImpactCategorySchema.options];
const COST_TIER_VALUES = [...CostTierSchema.options];

/**
 * Standard lowercase JSON Schema derived from Zod enums.
 * Array cardinalities are omitted here so Vertex AI controlled-decoding state
 * budgets stay compact; Zod validates exact min/max item counts post-parse.
 */
export const ACTION_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    mode: { type: "string", enum: ["gemini", "fallback"] },
    routine: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          timeWindow: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          whyItHelps: { type: "string" },
          impactCategory: { type: "string", enum: IMPACT_CATEGORY_VALUES },
          costTier: { type: "string", enum: COST_TIER_VALUES },
        },
        required: [
          "id",
          "timeWindow",
          "title",
          "detail",
          "whyItHelps",
          "impactCategory",
          "costTier",
        ],
      },
    },
    indoorHacks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          steps: {
            type: "array",
            items: { type: "string" },
          },
          whyItHelps: { type: "string" },
          impactCategory: { type: "string", enum: IMPACT_CATEGORY_VALUES },
          costTier: { type: "string", enum: COST_TIER_VALUES },
          setupMinutes: { type: "integer" },
        },
        required: [
          "id",
          "title",
          "steps",
          "whyItHelps",
          "impactCategory",
          "costTier",
          "setupMinutes",
        ],
      },
    },
    sustainableAlternatives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          replaces: { type: "string" },
          detail: { type: "string" },
          whyItHelps: { type: "string" },
          communityAngle: { type: "string" },
          impactCategory: { type: "string", enum: IMPACT_CATEGORY_VALUES },
          costTier: { type: "string", enum: COST_TIER_VALUES },
        },
        required: [
          "id",
          "title",
          "replaces",
          "detail",
          "whyItHelps",
          "communityAngle",
          "impactCategory",
          "costTier",
        ],
      },
    },
    communityAdvisoryDraft: { type: "string" },
  },
  required: [
    "headline",
    "mode",
    "routine",
    "indoorHacks",
    "sustainableAlternatives",
    "communityAdvisoryDraft",
  ],
};
