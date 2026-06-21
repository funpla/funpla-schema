import { z } from "zod/v3";

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
