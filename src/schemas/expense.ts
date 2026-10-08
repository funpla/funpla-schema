import { z } from "zod/v3";
import { feeTypeSchema, MAX_AMOUNT, validateBudget } from "./party";
import { planTypeSchema } from "./plan";

/**
 * 資金管理のスキーマ。
 *
 * 1 パーティーにつき 1 件。収入側（人数・会費・別途予算）はパーティー設定と同じ値で、
 * この API から読み書きしてもパーティー詳細に反映される。経費側（会場費・景品代・
 * 備品代・その他経費）は資金管理だけが持つ。
 *
 * 総額・残経費・プラン適用後の残額は入力中にも再計算する必要があるためレスポンスには
 * 含めず、クライアントが計算する。計算に必要なプラン金額だけをサーバーが返す。
 *
 * すべて主催者向けで Clerk 認証あり（/party/:partyId 配下）。パーティーに必ず紐づく
 * ため作成 / 削除の操作はなく、未保存のパーティーでは経費側が初期値で返る。
 */

// ── 共通 ──

/**
 * 会場費の金額種別
 * - `per_person`: 一人当たり（会場費の総額 = venueCost × guestCount）
 * - `total`: 総額（venueCost がそのまま総額）
 */
export const venueCostTypeSchema = z.enum(["per_person", "total"]);
export type VenueCostType = z.infer<typeof venueCostTypeSchema>;

/** 経費の金額。未入力は null（0 円と区別する） */
const costSchema = z.number().int().nonnegative().max(MAX_AMOUNT).nullable();

/**
 * 収入側。パーティー設定（人数・会費）と同じ値で、資金管理から更新すると
 * パーティー詳細にも反映される
 * - `guestCount`: 人数
 * - `feeType`: 会費の金額種別
 * - `fee`: feeType の単位での会費（未入力は null）
 * - `budget`: 別途予算（未入力は null）
 */
const incomeSchema = z.object({
  guestCount: z.number().int().positive().max(MAX_AMOUNT),
  feeType: feeTypeSchema,
  fee: z.number().int().nonnegative().max(MAX_AMOUNT).nullable(),
  budget: z.number().int().nonnegative().max(MAX_AMOUNT).nullable(),
});

/**
 * 経費側。資金管理だけが持つ
 * - `venueArea`: 会場を探すときの地域（未入力は null）
 * - `venueCostType`: 会場費の金額種別
 * - `venueCost`: venueCostType の単位での会場費
 * - `prizeCost`: 景品代
 * - `suppliesCost`: 備品代
 * - `otherCost`: その他経費
 */
const costsSchema = z.object({
  venueArea: z.string().max(50).nullable(),
  venueCostType: venueCostTypeSchema,
  venueCost: costSchema,
  prizeCost: costSchema,
  suppliesCost: costSchema,
  otherCost: costSchema,
});

/**
 * 残経費から差し引く FunPla のプラン
 * - `planType`: パーティーの現在のプラン
 * - `price`: そのプランの金額（free は 0）
 */
export const expensePlanSchema = z.object({
  planType: planTypeSchema,
  price: z.number().int().nonnegative(),
});
export type ExpensePlan = z.infer<typeof expensePlanSchema>;

// ── 取得（GET /party/:partyId/expenses） ──

/** GET /party/:partyId/expenses のパスパラメータ */
export const getExpensesParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type GetExpensesParams = z.infer<typeof getExpensesParamsSchema>;

/**
 * GET /party/:partyId/expenses のレスポンスボディ
 *
 * 経費が一度も保存されていないパーティーでは、経費側が初期値
 * （venueCostType は `per_person`、金額と地域は null）で返る。
 */
export const getExpensesResponseSchema = incomeSchema
  .merge(costsSchema)
  .extend({ plan: expensePlanSchema })
  .superRefine(validateBudget);
export type GetExpensesResponse = z.infer<typeof getExpensesResponseSchema>;

// ── 更新（PUT /party/:partyId/expenses） ──
//
// 収入側と経費側をまとめて保存する。収入側はパーティー設定の該当項目をそのまま更新し、
// 経費側と同じトランザクションで反映する。プラン金額はサーバーが決めるため送らない。

/** PUT /party/:partyId/expenses のパスパラメータ */
export const updateExpensesParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type UpdateExpensesParams = z.infer<typeof updateExpensesParamsSchema>;

/**
 * PUT /party/:partyId/expenses のリクエストボディ
 *
 * 差分ではなく全項目の最終状態を送る。未入力の項目は null を送る（空文字は送らない）。
 */
export const updateExpensesRequestSchema = incomeSchema
  .merge(costsSchema)
  .superRefine(validateBudget);
export type UpdateExpensesRequest = z.infer<typeof updateExpensesRequestSchema>;

/** PUT /party/:partyId/expenses のレスポンスボディ */
export const updateExpensesResponseSchema = z.object({});
export type UpdateExpensesResponse = z.infer<
  typeof updateExpensesResponseSchema
>;
