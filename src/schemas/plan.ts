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
  z.object({
    currentPlan: z.literal("free"),
    startedAt: z.string().date(),
    expiredAt: z.null(),
  }),
  z.object({
    currentPlan: z.literal("standard"),
    startedAt: z.string().date(),
    expiredAt: z.string().date(),
  }),
  z.object({
    currentPlan: z.literal("wedding"),
    startedAt: z.string().date(),
    expiredAt: z.string().date(),
  }),
]);
export type PartyPlan = z.infer<typeof partyPlanSchema>;

/**
 * プラン履歴の1件
 * - `fromPlanType`: 変更前のプランタイプ（初回契約時は null）
 * - `toPlanType`: 変更後のプランタイプ
 * - `amount`: 支払金額（無料の場合は null）
 * - `expiredAt`: プランの有効期限（free の場合は null）
 * - `paidAt`: 支払日時（無料の場合は null）
 * - `createdAt`: 履歴の作成日時
 */
export const planHistoryItemSchema = z.object({
  fromPlanType: planTypeSchema.nullable(),
  toPlanType: planTypeSchema,
  amount: z.number().int().nullable(),
  expiredAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PlanHistoryItem = z.infer<typeof planHistoryItemSchema>;
