import { z } from "zod/v3";

/**
 * プレイモード
 * - `solo`: 個人戦
 * - `team`: チーム戦
 */
export const quizPlayModeSchema = z.enum(["solo", "team"]);
export type QuizPlayMode = z.infer<typeof quizPlayModeSchema>;

/**
 * 問題タイプ
 * - `two_choice_photo_text_question`: 2択・写真テキスト問題文
 * - `two_choice_photo_text_answer`: 2択・写真テキスト回答
 * - `four_choice_photo_text_question`: 4択・写真テキスト問題文
 * - `four_choice_photo_text_answer`: 4択・写真テキスト回答
 */
export const questionTypeSchema = z.enum([
  "two_choice_photo_text_question",
  "two_choice_photo_text_answer",
  "four_choice_photo_text_question",
  "four_choice_photo_text_answer",
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

const quizBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  durationMinutes: z.number().int().positive(),
  playMode: quizPlayModeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** POST /parties/:partyId/quizzes のパスパラメータ */
export const createQuizParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type CreateQuizParams = z.infer<typeof createQuizParamsSchema>;

/** POST /parties/:partyId/quizzes のリクエストボディ */
export const createQuizRequestSchema = quizBaseSchema.pick({
  name: true,
  durationMinutes: true,
  playMode: true,
});
export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;

/** POST /parties/:partyId/quizzes のレスポンスボディ */
export const createQuizResponseSchema = z.object({ id: z.string().uuid() });
export type CreateQuizResponse = z.infer<typeof createQuizResponseSchema>;

/** GET /parties/:partyId/quizzes のパスパラメータ */
export const listQuizzesParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type ListQuizzesParams = z.infer<typeof listQuizzesParamsSchema>;

/** GET /parties/:partyId/quizzes のレスポンスボディ */
export const listQuizzesResponseSchema = z.object({
  quizzes: z.array(quizBaseSchema),
});
export type ListQuizzesResponse = z.infer<typeof listQuizzesResponseSchema>;

/** DELETE /parties/:partyId/quizzes/:quizId のパスパラメータ */
export const deleteQuizParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type DeleteQuizParams = z.infer<typeof deleteQuizParamsSchema>;

/** DELETE /parties/:partyId/quizzes/:quizId のレスポンスボディ */
export const deleteQuizResponseSchema = z.object({});
export type DeleteQuizResponse = z.infer<typeof deleteQuizResponseSchema>;
