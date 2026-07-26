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
