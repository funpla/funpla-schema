import { z } from "zod/v3";

/**
 * プランタイプ
 * - `free`: Free プラン
 * - `standard`: Standard プラン
 * - `wedding`: Wedding プラン
 */
export const planTypeSchema = z.enum(["free", "standard", "wedding"]);
export type PlanType = z.infer<typeof planTypeSchema>;

/** GET /party/:id/plan のパスパラメータ */
export const getPartyPlanParamsSchema = z.object({
  id: z.string().uuid(),
});
export type GetPartyPlanParams = z.infer<typeof getPartyPlanParamsSchema>;

/** GET /party/:id/plan のレスポンスボディ */
export const getPartyPlanResponseSchema = z.discriminatedUnion("currentPlan", [
  z.object({ currentPlan: z.literal("free"), expiredAt: z.null() }),
  z.object({
    currentPlan: z.literal("standard"),
    expiredAt: z.string().date(),
  }),
  z.object({ currentPlan: z.literal("wedding"), expiredAt: z.string().date() }),
]);
export type GetPartyPlanResponse = z.infer<typeof getPartyPlanResponseSchema>;
