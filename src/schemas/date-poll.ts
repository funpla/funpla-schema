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
 * 候補日入力（作成時に使用）。
 * 配列順が表示順（displayOrder）になる。同一日付の重複は不可。
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
 * - `contactInfo`: 変更がある時の連絡先（任意）
 * - `candidateDates`: 開催日候補（最大 5・重複不可、時間は持たない）
 */
export const createDatePollRequestSchema = z.object({
  description: z.string().min(1).max(200),
  contactInfo: z.string().max(200).nullable(),
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

/**
 * 回答（主催者向け一覧の 1 件）。候補日ごとの可否を持つ。
 * - `id`: 回答 id。集計対象の保存で行を指定するのに使う
 * - `isIncludedInTally`: 集計に含めるか。既定は true で、false の回答は候補日ごとの
 *   可否集計から外す（行自体は一覧に残す）
 */
const datePollAnswerItemSchema = z.object({
  id: z.string().uuid(),
  respondentName: z.string(),
  isIncludedInTally: z.boolean(),
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
  contactInfo: z.string().nullable(),
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
 * 編集できるのは説明・連絡先のみ（開催日候補は作成後は変更しない）。
 */
export const updateDatePollRequestSchema = z.object({
  description: z.string().min(1).max(200),
  contactInfo: z.string().max(200).nullable(),
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

// ── 回答の集計対象を保存（PUT /party/:partyId/date-poll/responses） ──
//
// 一覧の「集計に含める」チェックをまとめて保存する。回答そのものは参加者が作るため
// 行の追加・削除はなく、送られた回答だけを反映して送られなかった回答には手を触れない。
// 1 件だけ保存したい場合も要素 1 件の配列で送る。

/** PUT /party/:partyId/date-poll/responses のパスパラメータ */
export const updateDatePollResponsesParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type UpdateDatePollResponsesParams = z.infer<
  typeof updateDatePollResponsesParamsSchema
>;

/**
 * 保存する 1 件
 * - `id`: 対象の回答 id
 * - `isIncludedInTally`: 集計に含めるか
 */
const datePollResponseTallyInputSchema = z.object({
  id: z.string().uuid(),
  isIncludedInTally: z.boolean(),
});
export type DatePollResponseTallyInput = z.infer<
  typeof datePollResponseTallyInputSchema
>;

/**
 * PUT /party/:partyId/date-poll/responses のリクエストボディ
 * - `responses`: 保存する回答（0 件も可）。同じ id は 1 度だけ指定できる。
 *   指定パーティーの日程調整の回答でない id が含まれる場合は 404 を返す
 */
export const updateDatePollResponsesRequestSchema = z.object({
  responses: z
    .array(datePollResponseTallyInputSchema)
    .superRefine((responses, ctx) => {
      const ids = responses.map((r) => r.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "回答 id が重複しています",
        });
      }
    }),
});
export type UpdateDatePollResponsesRequest = z.infer<
  typeof updateDatePollResponsesRequestSchema
>;

/** PUT /party/:partyId/date-poll/responses のレスポンスボディ */
export const updateDatePollResponsesResponseSchema = z.object({});
export type UpdateDatePollResponsesResponse = z.infer<
  typeof updateDatePollResponsesResponseSchema
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
  contactInfo: z.string().nullable(),
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
