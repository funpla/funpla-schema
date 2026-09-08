import { z } from "zod/v3";

/**
 * 名簿のスキーマ。
 *
 * 出欠確認（参加募集）に集まった回答のうち「参加」と答えた人を一覧にし、主催者が
 * 行ごとにチェックと備考を付けていく表。カラムは名前・チェック・備考の 3 つで、
 * 名前は出欠確認の回答が正なので名簿からは編集できない。
 *
 * 参加者一覧とチェック / 備考の合成はサーバー側で行い、クライアントは返ってきた行を
 * そのまま描画する。行の識別子は出欠確認の回答 id（responseId）で、名簿固有の id は
 * 持たない（チェックも備考も付いていない行はサーバー側にレコードが存在しないため）。
 *
 * すべて主催者向けで Clerk 認証あり（/party/:partyId 配下）。名簿は出欠確認から導出される
 * ため作成 / 削除の操作はなく、出欠確認が未作成のパーティーでは 404 を返す。
 */

// ── 共通 ──

/**
 * 名簿の 1 行
 * - `responseId`: 出欠確認の回答 id。行の識別子で、編集 API でもこの id で行を指定する
 * - `name`: 回答者名（出欠確認の回答由来・名簿では編集不可）
 * - `isChecked`: チェック列。一度も編集されていない行は false
 * - `note`: 備考列。未入力は null
 */
export const rosterEntrySchema = z.object({
  responseId: z.string().uuid(),
  name: z.string(),
  isChecked: z.boolean(),
  note: z.string().nullable(),
});
export type RosterEntry = z.infer<typeof rosterEntrySchema>;

// ── 取得（GET /party/:partyId/roster） ──

/** GET /party/:partyId/roster のパスパラメータ */
export const getRosterParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type GetRosterParams = z.infer<typeof getRosterParamsSchema>;

/**
 * GET /party/:partyId/roster のレスポンスボディ
 * - `entries`: 「参加」と回答した人だけの一覧。名前の辞書順。
 *   不参加の回答は含めない
 */
export const getRosterResponseSchema = z.object({
  entries: z.array(rosterEntrySchema),
});
export type GetRosterResponse = z.infer<typeof getRosterResponseSchema>;

// ── 編集（PUT /party/:partyId/roster） ──
//
// 名簿表の行をまとめて保存する。行そのもの（誰が名簿に載るか）は出欠確認の回答が決める
// ため、タイムテーブルのような総入れ替えはせず、送られた行だけを反映して送られなかった
// 行には手を触れない。1 行だけ保存したい場合も要素 1 件の配列で送る。
// チェックが外れていて備考も null の行は未編集と同じ意味なので、サーバーは保持している
// レコードを消してその状態に戻す。

/**
 * 保存する 1 行
 * - `responseId`: 対象の出欠確認の回答 id
 * - `isChecked`: チェックの有無
 * - `note`: 備考。未入力は null（空文字は送らない）
 *
 * 差分ではなく行の最終状態を送るため、チェックだけを変える場合も備考を一緒に送る。
 */
const rosterEntryInputSchema = z.object({
  responseId: z.string().uuid(),
  isChecked: z.boolean(),
  note: z.string().max(200).nullable(),
});
export type RosterEntryInput = z.infer<typeof rosterEntryInputSchema>;

/** PUT /party/:partyId/roster のパスパラメータ */
export const updateRosterParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type UpdateRosterParams = z.infer<typeof updateRosterParamsSchema>;

/**
 * PUT /party/:partyId/roster のリクエストボディ
 * - `entries`: 保存する行（0 件も可）。同じ responseId は 1 度だけ指定できる。
 *   指定パーティーの「参加」回答でない responseId が含まれる場合は 404 を返す
 */
export const updateRosterRequestSchema = z.object({
  entries: z.array(rosterEntryInputSchema).superRefine((entries, ctx) => {
    const ids = entries.map((e) => e.responseId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "responseId が重複しています",
      });
    }
  }),
});
export type UpdateRosterRequest = z.infer<typeof updateRosterRequestSchema>;

/** PUT /party/:partyId/roster のレスポンスボディ */
export const updateRosterResponseSchema = z.object({});
export type UpdateRosterResponse = z.infer<typeof updateRosterResponseSchema>;
