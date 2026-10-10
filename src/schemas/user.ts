import { z } from "zod/v3";

/** GET /users のレスポンスボディ */
export const getUserResponseSchema = z.object({
  /** ハンドルネーム（未設定の場合は null） */
  handleName: z.string().nullable(),
});
export type GetUserResponse = z.infer<typeof getUserResponseSchema>;

/** PATCH /users/handle-name のリクエストボディ */
export const updateHandleNameRequestSchema = z.object({
  /** 新しいハンドルネーム */
  handleName: z.string().min(1),
});
export type UpdateHandleNameRequest = z.infer<
  typeof updateHandleNameRequestSchema
>;

/** PATCH /users/handle-name のレスポンスボディ */
export const updateHandleNameResponseSchema = z.object({});
export type UpdateHandleNameResponse = z.infer<
  typeof updateHandleNameResponseSchema
>;

// ── 退会（DELETE /user） ──
//
// ログイン中のユーザー本人を退会させる。リクエストボディは持たない（確認は画面側で行う）。
// 退会すると次のとおりになり、元に戻せない。
// - ログイン用のアカウント（Clerk）を削除する。同じメールアドレスで新規登録し直すことはできる
// - 作成したパーティーと、それに紐づくデータ（参加者の回答・名簿・クイズ・ビンゴ・
//   タイムテーブル・画像 / 動画など）をすべて削除する
// - 購入記録（プラン・QRビンゴカード・クイズ作成枠）は、法令上の保存義務のため削除せず残す。
//   氏名・メールアドレスなどの個人情報は持たず、日時・金額・商品・決済 ID のみ
// - 有料プランの残り期間や未使用のビンゴカード・クイズ作成枠は返金しない

/** DELETE /user のレスポンスボディ */
export const withdrawUserResponseSchema = z.object({});
export type WithdrawUserResponse = z.infer<typeof withdrawUserResponseSchema>;
