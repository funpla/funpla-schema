import { z } from "zod/v3";

/** POST /party/:partyId/bingo-cards/checkout のパスパラメータ */
export const purchaseBingoCardsParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type PurchaseBingoCardsParams = z.infer<
  typeof purchaseBingoCardsParamsSchema
>;

/**
 * POST /party/:partyId/bingo-cards/checkout のリクエストボディ
 * - `packCount`: 購入するパック数（1 パック = 10 枚 / 110 円）。ビンゴ中の追加購入も同じ経路。
 *   1 回の購入は最大 30 パック（＝300 枚）までとする。
 */
export const purchaseBingoCardsRequestSchema = z.object({
  packCount: z.number().int().positive().max(30),
});
export type PurchaseBingoCardsRequest = z.infer<
  typeof purchaseBingoCardsRequestSchema
>;

/**
 * POST /party/:partyId/bingo-cards/checkout のレスポンスボディ
 * - `url`: 決済ページの URL
 */
export const purchaseBingoCardsResponseSchema = z.object({ url: z.string() });
export type PurchaseBingoCardsResponse = z.infer<
  typeof purchaseBingoCardsResponseSchema
>;

/** GET /party/:partyId/bingo-cards のパスパラメータ */
export const getBingoCardBalanceParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type GetBingoCardBalanceParams = z.infer<
  typeof getBingoCardBalanceParamsSchema
>;

/**
 * GET /party/:partyId/bingo-cards のレスポンスボディ
 * - `remainingCount`: 現在有効な残枚数（購入で増え、参加で減る）。操作画面の残枚数表示に使う。
 */
export const getBingoCardBalanceResponseSchema = z.object({
  remainingCount: z.number().int().nonnegative(),
});
export type GetBingoCardBalanceResponse = z.infer<
  typeof getBingoCardBalanceResponseSchema
>;
