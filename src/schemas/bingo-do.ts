import { z } from "zod/v3";

// ══════════════════════════════════════════════════════════════════════════
// ビンゴ実行(Durable Object)用スキーマ
//
// ビンゴの「実行セッション」は Cloudflare Durable Object 1 インスタンスで表す
// （クイズと同じ仕組み）。1 パーティーにつき 1 ビンゴのため、実行中セッションは
// bingo_sessions の partyId PK で「party ごとに 0/1」を保証し、二重起動を物理的に防ぐ。
// sessionId は初期化時に crypto.randomUUID() で採番する DO キー（idFromName）兼
// 参加 URL /game/bingo/:id の id。終了時に bingo_sessions 行を DELETE する。
//
// ここでは host（操作画面）による HTTP のセッション start / end / 現在取得のみを定義する。
// 抽選の進行や参加者の WebSocket スキーマは DO 実装フェーズで追加する。
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /party/:partyId/bingo/session のパスパラメータ
 */
export const getBingoSessionParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type GetBingoSessionParams = z.infer<typeof getBingoSessionParamsSchema>;

/**
 * GET /party/:partyId/bingo/session のレスポンス。
 * 実行中セッションが無ければ sessionId は null。
 */
export const getBingoSessionResponseSchema = z.object({
  sessionId: z.string().uuid().nullable(),
});
export type GetBingoSessionResponse = z.infer<
  typeof getBingoSessionResponseSchema
>;

/**
 * POST /party/:partyId/bingo/session/start のパスパラメータ。
 * sessionId を採番して DO 初期化を起動する。既に実行中なら既存 sessionId へ復帰する
 */
export const startBingoSessionParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type StartBingoSessionParams = z.infer<
  typeof startBingoSessionParamsSchema
>;

/**
 * POST /party/:partyId/bingo/session/start のレスポンス。
 */
export const startBingoSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
});
export type StartBingoSessionResponse = z.infer<
  typeof startBingoSessionResponseSchema
>;

/**
 * POST /party/:partyId/bingo/session/end のパスパラメータ。
 * bingo_sessions レコード削除 + DO 掃除を起動する。実行中が無ければ no-op（冪等）。
 */
export const endBingoSessionParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type EndBingoSessionParams = z.infer<typeof endBingoSessionParamsSchema>;
