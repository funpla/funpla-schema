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
// HTTP のセッション start / end / 現在取得に加え、抽選進行の WebSocket メッセージ
// （host コマンド / 各ロールの受信 state / 演出イベント）も定義する。
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

// ══════════════════════════════════════════════════════════════════════════
// WebSocket: ビンゴ実行（host / display / participant）
//
// 認証の当て方が違うのでパスを分ける:
//   participant : GET /game/bingo/:id                       （匿名, sessionId キー）
//   host        : GET /party/:partyId/bingo/session/host    （Clerk, partyId → sessionId 解決）
//   display     : GET /party/:partyId/bingo/session/display （Clerk, partyId → sessionId 解決）
//
// 進行はすべて WebSocket。ビンゴ判定は participant のクライアント側で card × drawnNumbers から行い、
// DO は「誰がビンゴか」を追わない。リーチ集約（autoReachNumbers）は演出のためだけに DO が持つ。
// 直近の抽選番号（current）は drawnNumbers.at(-1) で各自導出する（別途持たない）。
// ══════════════════════════════════════════════════════════════════════════

/** フェーズ */
export const bingoSessionPhaseSchema = z.enum([
  "lobby", // 初期化済み・開始待ち（参加者は接続可）
  "playing", // 抽選進行中
  "finished", // 終了
]);
export type BingoSessionPhase = z.infer<typeof bingoSessionPhaseSchema>;

/**
 * ビンゴカード。5×5。各セルは番号(1..75) または null。中央([2][2]) = FREE = null。
 * 開マス・ビンゴは card × drawnNumbers から client が導出する。
 */
export const bingoCardSchema = z
  .array(z.array(z.number().int().min(1).max(75).nullable()).length(5))
  .length(5);
export type BingoCard = z.infer<typeof bingoCardSchema>;

// ── 接続（ロールでパスを分ける）─────────────────────────────────────────────

/** participant の WS 接続先 /game/bingo/:id のパスパラメータ（id = sessionId） */
export const bingoParticipantConnectParamsSchema = z.object({
  id: z.string().uuid(),
});
export type BingoParticipantConnectParams = z.infer<
  typeof bingoParticipantConnectParamsSchema
>;

/**
 * participant の WS 接続クエリ。ハンドルネーム等は無い（カードは自動で埋まる・手動操作なし）。
 * participantId はクライアントが crypto.randomUUID() 採番＋localStorage 保存し毎回付ける。
 * 既存 participantId → 復帰（再消費なし）、未知 → 新規（カード配布＋カード 1 枚消費）。
 */
export const bingoParticipantConnectQuerySchema = z.object({
  participantId: z.string().uuid(),
});
export type BingoParticipantConnectQuery = z.infer<
  typeof bingoParticipantConnectQuerySchema
>;

/** host の WS 接続先 /party/:partyId/bingo/session/host のパスパラメータ */
export const bingoHostConnectParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type BingoHostConnectParams = z.infer<
  typeof bingoHostConnectParamsSchema
>;

/** display の WS 接続先 /party/:partyId/bingo/session/display のパスパラメータ */
export const bingoDisplayConnectParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type BingoDisplayConnectParams = z.infer<
  typeof bingoDisplayConnectParamsSchema
>;

// ── エラー ───────────────────────────────────────────────────────────────

export const bingoSessionErrorCodeSchema = z.enum([
  "invalid_phase", // その状態では実行できない（例: finished での draw）
  "sold_out", // カード在庫切れ（参加不可）
]);
export type BingoSessionErrorCode = z.infer<typeof bingoSessionErrorCodeSchema>;

/** エラー通知（送信元にのみ返す） */
export const bingoSessionErrorSchema = z.object({
  type: z.literal("error"),
  code: bingoSessionErrorCodeSchema,
  message: z.string(),
});
export type BingoSessionError = z.infer<typeof bingoSessionErrorSchema>;

// ── 受信 state の共通骨格 ──────────────────────────────────────────────────

/** すべての受信 state に共通する骨格 */
const bingoSessionStateBaseSchema = z.object({
  type: z.literal("state"),
  phase: bingoSessionPhaseSchema,
  /** 抽選済み番号（抽選順）。末尾が直近の抽選番号 */
  drawnNumbers: z.array(z.number().int().min(1).max(75)),
});

// ══════════════════════════════════════════════════════════════════════════
// host（操作画面）: 送信 = コマンド / 受信 = 進行用 state
// ══════════════════════════════════════════════════════════════════════════

// ── 送信（Client → Server）─────────────────────────────────────────────────

/** 抽選（1 つ引く） */
const bingoDrawSchema = z.object({ type: z.literal("draw") });

/** 手動リーチ番号を丸ごと置換（紙ビンゴ用）。現在リーチ中の全番号を送る */
export const bingoSetManualReachNumbersSchema = z.object({
  type: z.literal("set_manual_reach_numbers"),
  numbers: z.array(z.number().int().min(1).max(75)),
});
export type BingoSetManualReachNumbers = z.infer<
  typeof bingoSetManualReachNumbersSchema
>;

/** host が送るコマンド */
export const bingoSessionHostCommandSchema = z.discriminatedUnion("type", [
  bingoDrawSchema,
  bingoSetManualReachNumbersSchema,
]);
export type BingoSessionHostCommand = z.infer<
  typeof bingoSessionHostCommandSchema
>;

// ── 受信（Server → Client）─────────────────────────────────────────────────

/** host 受信 state。進行に必要な情報のみ（ビンゴ者・auto リーチは持たない） */
export const bingoSessionHostStateSchema = bingoSessionStateBaseSchema.extend({
  /** 接続中の参加者数 */
  participantCount: z.number().int().nonnegative(),
  /** 手動申告済みのリーチ番号（紙ビンゴ用）。再接続時に手動リーチ UI を復元するために返す */
  manualReachNumbers: z.array(z.number().int().min(1).max(75)),
});
export type BingoSessionHostState = z.infer<typeof bingoSessionHostStateSchema>;

/** host が受信する全メッセージ */
export const bingoSessionHostServerMessageSchema = z.discriminatedUnion(
  "type",
  [bingoSessionHostStateSchema, bingoSessionErrorSchema],
);
export type BingoSessionHostServerMessage = z.infer<
  typeof bingoSessionHostServerMessageSchema
>;

// ══════════════════════════════════════════════════════════════════════════
// participant（参加画面）: 送信なし（手動操作なし）/ 受信 = 自分のカード + 抽選
// ══════════════════════════════════════════════════════════════════════════

/**
 * participant 受信 state。自分のカードと抽選済み番号のみ。
 * 開マス・isBingo・リーチ・ビンゴエフェクトは client が card × drawnNumbers から導出する。
 * 初期受信（参加/復帰）ではビンゴアニメを出さず、以降の draw で not-bingo→bingo のときだけ
 * 出す、の区別も client 側で行う。
 */
export const bingoSessionParticipantStateSchema =
  bingoSessionStateBaseSchema.extend({
    /** 自分のカード（5×5、中央 null）。参加時に採番され復帰でも同じ */
    card: bingoCardSchema,
  });
export type BingoSessionParticipantState = z.infer<
  typeof bingoSessionParticipantStateSchema
>;

/** participant が受信する全メッセージ */
export const bingoSessionParticipantServerMessageSchema = z.discriminatedUnion(
  "type",
  [bingoSessionParticipantStateSchema, bingoSessionErrorSchema],
);
export type BingoSessionParticipantServerMessage = z.infer<
  typeof bingoSessionParticipantServerMessageSchema
>;

// ══════════════════════════════════════════════════════════════════════════
// display（再生画面）: 送信なし / 受信 = 投影用 state + 演出イベント
// ══════════════════════════════════════════════════════════════════════════

/** display 受信 state。投影用。ゾロ目チャンスは drawnNumbers.at(-1) から display 側が導出 */
export const bingoSessionDisplayStateSchema =
  bingoSessionStateBaseSchema.extend({
    /** 接続中の参加者数（表示用） */
    participantCount: z.number().int().nonnegative(),
  });
export type BingoSessionDisplayState = z.infer<
  typeof bingoSessionDisplayStateSchema
>;

/**
 * リーチ煽り演出（draw イベントに任意で同梱）。targetNumber R が出るか煽る。
 * 強のとき R が実際に出る確率が上がっている。number を出す前にサスペンス演出する。
 */
export const bingoReachTauntSchema = z.object({
  intensity: z.enum(["weak", "strong"]),
  targetNumber: z.number().int().min(1).max(75),
});
export type BingoReachTaunt = z.infer<typeof bingoReachTauntSchema>;

/**
 * ビンゴアニメ演出（draw イベントに任意で同梱）。採用番号がリーチ番号だった ＝ 誰かビンゴ。
 * 誰がビンゴかは問わない。pattern は 3 種のどれか（サーバーが選ぶ）。
 */
export const bingoBingoEffectSchema = z.object({
  pattern: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type BingoBingoEffect = z.infer<typeof bingoBingoEffectSchema>;

/**
 * 抽選イベント（draw の**たびに**送る）。通常抽選もこれが届く。
 * display は 1 メッセージで演出を順序制御する: reachTaunt があればサスペンス → number をリビール
 * → bingo があればビンゴアニメ。ゾロ目チャンスは number がゾロ目(11..66)かで display 側が導出。
 */
export const bingoDrawEventSchema = z.object({
  type: z.literal("draw"),
  /** 今引いた番号（リビール対象。drawnNumbers.at(-1) と一致） */
  number: z.number().int().min(1).max(75),
  /** リーチ煽り。無ければ null */
  reachTaunt: bingoReachTauntSchema.nullable(),
  /** 誰かビンゴ。無ければ null */
  bingo: bingoBingoEffectSchema.nullable(),
});
export type BingoDrawEvent = z.infer<typeof bingoDrawEventSchema>;

/** display が受信する全メッセージ（state スナップショット + draw イベント + error） */
export const bingoSessionDisplayServerMessageSchema = z.discriminatedUnion(
  "type",
  [
    bingoSessionDisplayStateSchema,
    bingoDrawEventSchema,
    bingoSessionErrorSchema,
  ],
);
export type BingoSessionDisplayServerMessage = z.infer<
  typeof bingoSessionDisplayServerMessageSchema
>;
