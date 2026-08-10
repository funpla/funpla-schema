import { z } from "zod/v3";

/**
 * 日程調整（出欠確認機能・日程が未定の場合）のスキーマ。
 *
 * 主催者は候補日を最大 5 つ提示し、受け取り手から各候補日の可否を集めて開催日を決める。
 * 主催者向けエンドポイントは Clerk 認証あり（/party/:partyId 配下）、
 * 参加者向けエンドポイントは認証なしで shareToken からアクセスする（/date-poll/:shareToken）。
 */

/** 候補日は最大 5 件 */
export const MAX_DATE_POLL_CANDIDATES = 5;

// ── 共通 ──

/**
 * 候補日入力（作成・編集共通）。
 * 配列順が表示順（displayOrder）になる。同一日付の重複は不可。
 * 編集時はこの日付集合で置き換える（残る日付は既存行を維持、消えた日付はその可否ごと削除）。
 */
const candidateDatesInputSchema = z
  .array(z.string().date())
  .min(1)
  .max(MAX_DATE_POLL_CANDIDATES)
  .superRefine((dates, ctx) => {
    if (new Set(dates).size !== dates.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "候補日が重複しています",
      });
    }
  });

/** 候補日（レスポンス用） */
const candidateSchema = z.object({
  id: z.string().uuid(),
  date: z.string().date(),
  /** 表示順（0 始まり） */
  displayOrder: z.number().int().nonnegative(),
});

// ── 作成（POST /party/:partyId/date-poll） ──

/** POST /party/:partyId/date-poll のパスパラメータ */
export const createDatePollParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type CreateDatePollParams = z.infer<typeof createDatePollParamsSchema>;

/**
 * POST /party/:partyId/date-poll のリクエストボディ
 * - `description`: 説明。作成時にパーティー説明を初期値として渡す想定（必須）
 * - `contactInfo`: 変更がある時の連絡先（必須）
 * - `candidateDates`: 開催日候補（最大 5・重複不可、時間は持たない）
 */
export const createDatePollRequestSchema = z.object({
  description: z.string().min(1).max(200),
  contactInfo: z.string().min(1).max(200),
  candidateDates: candidateDatesInputSchema,
});
export type CreateDatePollRequest = z.infer<typeof createDatePollRequestSchema>;

/**
 * POST /party/:partyId/date-poll のレスポンスボディ
 * 主催者用リソースは partyId でアクセスするため id は不要（作成後は編集ページへ遷移するだけ）。
 */
export const createDatePollResponseSchema = z.object({});
export type CreateDatePollResponse = z.infer<
  typeof createDatePollResponseSchema
>;

// ── 取得（主催者）（GET /party/:partyId/date-poll） ──

/** 回答（主催者向け一覧の 1 件）。候補日ごとの可否を持つ。 */
const datePollAnswerItemSchema = z.object({
  respondentName: z.string(),
  availabilities: z.array(
    z.object({
      candidateId: z.string().uuid(),
      /** true = 可、false = 否 */
      isAvailable: z.boolean(),
    }),
  ),
  createdAt: z.string().datetime(),
});

/** GET /party/:partyId/date-poll のパスパラメータ */
export const getDatePollParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type GetDatePollParams = z.infer<typeof getDatePollParamsSchema>;

/**
 * GET /party/:partyId/date-poll のレスポンスボディ（主催者向け・回答集計含む）
 * - `partyName`: タイトルとして表示するパーティー名（編集不可）
 * - `candidates`: displayOrder 昇順
 * - `responses`: 受け取り手の回答一覧
 */
export const getDatePollResponseSchema = z.object({
  shareToken: z.string().uuid(),
  partyName: z.string(),
  description: z.string(),
  contactInfo: z.string(),
  candidates: z.array(candidateSchema),
  responses: z.array(datePollAnswerItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GetDatePollResponse = z.infer<typeof getDatePollResponseSchema>;

// ── 編集（PUT /party/:partyId/date-poll） ──

/** PUT /party/:partyId/date-poll のパスパラメータ */
export const updateDatePollParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type UpdateDatePollParams = z.infer<typeof updateDatePollParamsSchema>;

/**
 * PUT /party/:partyId/date-poll のリクエストボディ
 * 送信した最終状態で置き換える。candidateDates は日付でマッチングして差分反映する
 * （残る日付は既存の可否を維持、消えた日付はその候補日・可否ごと削除、増えた日付は追加）。
 */
export const updateDatePollRequestSchema = z.object({
  description: z.string().min(1).max(200),
  contactInfo: z.string().min(1).max(200),
  candidateDates: candidateDatesInputSchema,
});
export type UpdateDatePollRequest = z.infer<typeof updateDatePollRequestSchema>;

/** PUT /party/:partyId/date-poll のレスポンスボディ */
export const updateDatePollResponseSchema = z.object({});
export type UpdateDatePollResponse = z.infer<
  typeof updateDatePollResponseSchema
>;

// ── 削除（DELETE /party/:partyId/date-poll） ──

/** DELETE /party/:partyId/date-poll のパスパラメータ */
export const deleteDatePollParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type DeleteDatePollParams = z.infer<typeof deleteDatePollParamsSchema>;

/** DELETE /party/:partyId/date-poll のレスポンスボディ */
export const deleteDatePollResponseSchema = z.object({});
export type DeleteDatePollResponse = z.infer<
  typeof deleteDatePollResponseSchema
>;

// ── 参加者: フォーム取得（GET /date-poll/:shareToken・認証なし） ──

/** GET /date-poll/:shareToken のパスパラメータ */
export const getDatePollFormParamsSchema = z.object({
  shareToken: z.string().uuid(),
});
export type GetDatePollFormParams = z.infer<typeof getDatePollFormParamsSchema>;

/**
 * GET /date-poll/:shareToken のレスポンスボディ（参加者向けフォーム表示用）
 * - `partyName`: タイトルとして表示するパーティー名
 * - `candidates`: 回答対象の候補日（displayOrder 昇順）
 */
export const getDatePollFormResponseSchema = z.object({
  partyName: z.string(),
  description: z.string(),
  contactInfo: z.string(),
  candidates: z.array(candidateSchema),
});
export type GetDatePollFormResponse = z.infer<
  typeof getDatePollFormResponseSchema
>;

// ── 参加者: 回答送信（POST /date-poll/:shareToken/responses・認証なし） ──

/** POST /date-poll/:shareToken/responses のパスパラメータ */
export const submitDatePollResponseParamsSchema = z.object({
  shareToken: z.string().uuid(),
});
export type SubmitDatePollResponseParams = z.infer<
  typeof submitDatePollResponseParamsSchema
>;

/**
 * POST /date-poll/:shareToken/responses のリクエストボディ
 * - `respondentName`: 回答者名
 * - `availabilities`: 候補日ごとの可否。全候補日ぶんを送る想定
 *   （candidateId の妥当性・網羅性はサーバー側で検証する）
 */
export const submitDatePollResponseRequestSchema = z.object({
  respondentName: z.string().min(1).max(50),
  availabilities: z
    .array(
      z.object({
        candidateId: z.string().uuid(),
        isAvailable: z.boolean(),
      }),
    )
    .min(1),
});
export type SubmitDatePollResponseRequest = z.infer<
  typeof submitDatePollResponseRequestSchema
>;

/** POST /date-poll/:shareToken/responses のレスポンスボディ（回答は編集不可のため返す情報なし） */
export const submitDatePollResponseResponseSchema = z.object({});
export type SubmitDatePollResponseResponse = z.infer<
  typeof submitDatePollResponseResponseSchema
>;
