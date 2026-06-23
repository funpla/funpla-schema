import { z } from "zod/v3";

/**
 * プランタイプ
 * - `free`: Free プラン
 * - `standard`: Standard プラン
 * - `wedding`: Wedding プラン
 */
export const planTypeSchema = z.enum(["free", "standard", "wedding"]);
export type PlanType = z.infer<typeof planTypeSchema>;

/** プラン情報。free の場合は expiredAt が null */
export const partyPlanSchema = z.discriminatedUnion("currentPlan", [
  z.object({ currentPlan: z.literal("free"), expiredAt: z.null() }),
  z.object({
    currentPlan: z.literal("standard"),
    expiredAt: z.string().date(),
  }),
  z.object({
    currentPlan: z.literal("wedding"),
    expiredAt: z.string().date(),
  }),
]);
export type PartyPlan = z.infer<typeof partyPlanSchema>;
