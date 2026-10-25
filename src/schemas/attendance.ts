import { z } from "zod/v3";

/**
 * 出欠確認（出欠確認機能・日程が確定済みの場合）のスキーマ。
 *
 * 確定した日程（日付・時間はパーティーから表示するだけ）に対して、受け取り手から
 * 参加 / 不参加を集める。スペシャルプランのときはウェディングオプションを有効化でき、
 * 有効時は回答者が続柄（新郎 / 新婦 / 両方の友人）を選ぶ。
 * 主催者向けエンドポイントは Clerk 認証あり（/party/:partyId 配下）、
 * 参加者向けエンドポイントは認証なしで shareToken からアクセスする（/attendance/:shareToken）。
 */

/**
 * ウェディングオプションの続柄
 * - `groom`: 新郎の友人
 * - `bride`: 新婦の友人
 * - `both`: 両方の友人
 */
export const weddingRelationshipSchema = z.enum(["groom", "bride", "both"]);
export type WeddingRelationship = z.infer<typeof weddingRelationshipSchema>;

// ── 作成（POST /party/:partyId/attendance） ──

/** POST /party/:partyId/attendance のパスパラメータ */
export const createAttendanceParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type CreateAttendanceParams = z.infer<
  typeof createAttendanceParamsSchema
>;

/**
 * POST /party/:partyId/attendance のリクエストボディ
 * - `location`: 場所（任意）
 * - `feeEstimate`: 会費目安。「5,000〜7,000円」「未定」等に対応するため自由入力（任意）
 * - `contactInfo`: 変更がある時の連絡先（任意）
 * - `weddingOptionEnabled`: ウェディングオプション。スペシャルプランのときのみ true にできる
 *   （プランとの整合はサーバー側で検証する）
 */
export const createAttendanceRequestSchema = z.object({
  location: z.string().max(100).nullable(),
  feeEstimate: z.string().max(50).nullable(),
  contactInfo: z.string().max(200).nullable(),
  weddingOptionEnabled: z.boolean(),
});
export type CreateAttendanceRequest = z.infer<
  typeof createAttendanceRequestSchema
>;

/**
 * POST /party/:partyId/attendance のレスポンスボディ
 * 主催者用リソースは partyId でアクセスするため id は不要（作成後は編集ページへ遷移するだけ）。
 */
export const createAttendanceResponseSchema = z.object({});
export type CreateAttendanceResponse = z.infer<
  typeof createAttendanceResponseSchema
>;

// ── 取得（主催者）（GET /party/:partyId/attendance） ──

/**
 * 回答（主催者向け一覧の 1 件）。名簿の元データになる。
 * - `id`: 回答 id。集計対象の保存・名簿の行指定に使う
 * - `isIncludedInTally`: 集計に含めるか。既定は true で、false の回答は参加/不参加の
 *   集計から外し、名簿にも出さない（行自体は一覧に残す）
 */
const attendanceAnswerItemSchema = z.object({
  id: z.string().uuid(),
  respondentName: z.string(),
  isIncludedInTally: z.boolean(),
  /** true = 参加、false = 不参加 */
  isAttending: z.boolean(),
  /** ウェディングオプション有効時のみ値が入る。それ以外は null */
  weddingRelationship: weddingRelationshipSchema.nullable(),
  /** 参加者が任意で入力したメッセージ。未入力は null */
  message: z.string().nullable(),
  createdAt: z.string().datetime(),
});

/** GET /party/:partyId/attendance のパスパラメータ */
export const getAttendanceParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type GetAttendanceParams = z.infer<typeof getAttendanceParamsSchema>;

/**
 * GET /party/:partyId/attendance のレスポンスボディ（主催者向け・回答一覧含む）
 * - `party`: 表示専用の確定日程（パーティー由来。名前・開催日・開催時間）
 * - `responses`: 受け取り手の回答一覧（名簿は名前の辞書順ソートで生成する）
 */
export const getAttendanceResponseSchema = z.object({
  shareToken: z.string().uuid(),
  party: z.object({
    name: z.string(),
    startDate: z.string().date(),
    startTime: z.string().time({ precision: 0 }),
  }),
  location: z.string().nullable(),
  feeEstimate: z.string().nullable(),
  contactInfo: z.string().nullable(),
  weddingOptionEnabled: z.boolean(),
  responses: z.array(attendanceAnswerItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GetAttendanceResponse = z.infer<typeof getAttendanceResponseSchema>;

// ── 編集（PUT /party/:partyId/attendance） ──

/** PUT /party/:partyId/attendance のパスパラメータ */
export const updateAttendanceParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type UpdateAttendanceParams = z.infer<
  typeof updateAttendanceParamsSchema
>;

/** PUT /party/:partyId/attendance のリクエストボディ */
export const updateAttendanceRequestSchema = z.object({
  location: z.string().max(100).nullable(),
  feeEstimate: z.string().max(50).nullable(),
  contactInfo: z.string().max(200).nullable(),
  weddingOptionEnabled: z.boolean(),
});
export type UpdateAttendanceRequest = z.infer<
  typeof updateAttendanceRequestSchema
>;

/** PUT /party/:partyId/attendance のレスポンスボディ */
export const updateAttendanceResponseSchema = z.object({});
export type UpdateAttendanceResponse = z.infer<
  typeof updateAttendanceResponseSchema
>;

// ── 削除（DELETE /party/:partyId/attendance） ──

/** DELETE /party/:partyId/attendance のパスパラメータ */
export const deleteAttendanceParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type DeleteAttendanceParams = z.infer<
  typeof deleteAttendanceParamsSchema
>;

/** DELETE /party/:partyId/attendance のレスポンスボディ */
export const deleteAttendanceResponseSchema = z.object({});
export type DeleteAttendanceResponse = z.infer<
  typeof deleteAttendanceResponseSchema
>;

// ── 回答の集計対象を保存（PUT /party/:partyId/attendance/responses） ──
//
// 一覧の「集計に含める」チェックをまとめて保存する。回答そのものは参加者が作るため
// 行の追加・削除はなく、送られた回答だけを反映して送られなかった回答には手を触れない。
// 1 件だけ保存したい場合も要素 1 件の配列で送る。
// false にした回答は名簿（GET /party/:partyId/roster）からも外れる。

/** PUT /party/:partyId/attendance/responses のパスパラメータ */
export const updateAttendanceResponsesParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type UpdateAttendanceResponsesParams = z.infer<
  typeof updateAttendanceResponsesParamsSchema
>;

/**
 * 保存する 1 件
 * - `id`: 対象の回答 id
 * - `isIncludedInTally`: 集計に含めるか
 */
const attendanceResponseTallyInputSchema = z.object({
  id: z.string().uuid(),
  isIncludedInTally: z.boolean(),
});
export type AttendanceResponseTallyInput = z.infer<
  typeof attendanceResponseTallyInputSchema
>;

/**
 * PUT /party/:partyId/attendance/responses のリクエストボディ
 * - `responses`: 保存する回答（0 件も可）。同じ id は 1 度だけ指定できる。
 *   指定パーティーの出欠確認の回答でない id が含まれる場合は 404 を返す
 */
export const updateAttendanceResponsesRequestSchema = z.object({
  responses: z
    .array(attendanceResponseTallyInputSchema)
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
export type UpdateAttendanceResponsesRequest = z.infer<
  typeof updateAttendanceResponsesRequestSchema
>;

/** PUT /party/:partyId/attendance/responses のレスポンスボディ */
export const updateAttendanceResponsesResponseSchema = z.object({});
export type UpdateAttendanceResponsesResponse = z.infer<
  typeof updateAttendanceResponsesResponseSchema
>;

// ── 参加者: フォーム取得（GET /attendance/:shareToken・認証なし） ──

/** GET /attendance/:shareToken のパスパラメータ */
export const getAttendanceFormParamsSchema = z.object({
  shareToken: z.string().uuid(),
});
export type GetAttendanceFormParams = z.infer<
  typeof getAttendanceFormParamsSchema
>;

/**
 * GET /attendance/:shareToken のレスポンスボディ（参加者向けフォーム表示用）
 * - `partyName` / `startDate` / `startTime`: 表示専用の確定日程（パーティー由来）
 * - `weddingOptionEnabled`: true のとき回答フォームに続柄の選択を出す
 */
export const getAttendanceFormResponseSchema = z.object({
  partyName: z.string(),
  startDate: z.string().date(),
  startTime: z.string().time({ precision: 0 }),
  location: z.string().nullable(),
  feeEstimate: z.string().nullable(),
  contactInfo: z.string().nullable(),
  weddingOptionEnabled: z.boolean(),
});
export type GetAttendanceFormResponse = z.infer<
  typeof getAttendanceFormResponseSchema
>;

// ── 参加者: 回答送信（POST /attendance/:shareToken/responses・認証なし） ──

/** POST /attendance/:shareToken/responses のパスパラメータ */
export const submitAttendanceResponseParamsSchema = z.object({
  shareToken: z.string().uuid(),
});
export type SubmitAttendanceResponseParams = z.infer<
  typeof submitAttendanceResponseParamsSchema
>;

/**
 * POST /attendance/:shareToken/responses のリクエストボディ
 * - `respondentName`: 回答者名
 * - `isAttending`: 参加(true) / 不参加(false)
 * - `weddingRelationship`: 続柄。ウェディングオプション有効時のみ必須、無効時は null
 *   （オプションの有効/無効との整合はサーバー側で検証する）
 * - `message`: 参加者が任意で入力するメッセージ。未入力は null
 */
export const submitAttendanceResponseRequestSchema = z.object({
  respondentName: z.string().min(1).max(50),
  isAttending: z.boolean(),
  weddingRelationship: weddingRelationshipSchema.nullable(),
  message: z.string().max(500).nullable(),
});
export type SubmitAttendanceResponseRequest = z.infer<
  typeof submitAttendanceResponseRequestSchema
>;

/** POST /attendance/:shareToken/responses のレスポンスボディ（回答は編集不可のため返す情報なし） */
export const submitAttendanceResponseResponseSchema = z.object({});
export type SubmitAttendanceResponseResponse = z.infer<
  typeof submitAttendanceResponseResponseSchema
>;
