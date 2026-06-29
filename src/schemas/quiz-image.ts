import { z } from "zod/v3";

// ── 画像アップロード用 presigned URL の発行 ──
//
// FE は画像を R2 に直接アップロードする。保存前に、必要枚数ぶんの
// presigned PUT URL をまとめて要求する。
// - key はサーバーが採番（クライアントに任意パスを切らせない）。
// - FE は各 uploadUrl に File を並列 PUT → 得た key を imageKey として
//   クイズ編集（PUT /questions）に詰める。
// - レスポンスの配列順は要求順に対応する。

/** POST /party/:partyId/quiz-images/presign のパスパラメータ */
export const createImageUploadUrlsParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type CreateImageUploadUrlsParams = z.infer<
  typeof createImageUploadUrlsParamsSchema
>;

/**
 * POST /party/:partyId/quiz-images/presign のリクエストボディ
 * これからアップロードする画像の枚数。
 */
export const createImageUploadUrlsRequestSchema = z.object({
  count: z.number().int().positive(),
});
export type CreateImageUploadUrlsRequest = z.infer<
  typeof createImageUploadUrlsRequestSchema
>;

/**
 * POST /party/:partyId/quiz-images/presign のレスポンスボディ
 * 要求枚数ぶんの key と presigned PUT URL。配列順は要求順に対応する。
 */
export const createImageUploadUrlsResponseSchema = z.object({
  uploads: z.array(
    z.object({
      /** サーバー採番の R2 key。アップロード後に imageKey として送る */
      key: z.string(),
      /** この key に File を PUT するための presigned URL */
      uploadUrl: z.string().url(),
    }),
  ),
});
export type CreateImageUploadUrlsResponse = z.infer<
  typeof createImageUploadUrlsResponseSchema
>;
