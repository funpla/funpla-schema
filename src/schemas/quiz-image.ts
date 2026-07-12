import { z } from "zod/v3";
import { mediaTypeSchema } from "./quiz";

// ── メディア（画像・動画）アップロード用 presigned URL の発行 ──
//
// FE はメディアを R2 に直接アップロードする。保存前に、必要数ぶんの
// presigned PUT URL をまとめて要求する。
// - key はサーバーが採番（クライアントに任意パスを切らせない）。
// - 各アップロードで mediaType（画像 / 動画）を指定する。サーバーはこれに
//   応じて許可する content-type や最大サイズを署名に含める。
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
 * これからアップロードするメディアの一覧。各要素で種別（画像 / 動画）を指定する。
 * 配列長がアップロード数になる。
 */
export const createImageUploadUrlsRequestSchema = z.object({
  //一つの質問に4枚、30問として合計で120枚なので、一旦130にしておく
  uploads: z
    .array(z.object({ mediaType: mediaTypeSchema }))
    .min(1)
    .max(130),
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
