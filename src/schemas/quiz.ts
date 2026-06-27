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

/** POST /party/:partyId/quizzes のパスパラメータ */
export const createQuizParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type CreateQuizParams = z.infer<typeof createQuizParamsSchema>;

/** POST /party/:partyId/quizzes のリクエストボディ */
export const createQuizRequestSchema = quizBaseSchema.pick({
  name: true,
  durationMinutes: true,
  playMode: true,
});
export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;

/** POST /party/:partyId/quizzes のレスポンスボディ */
export const createQuizResponseSchema = z.object({ id: z.string().uuid() });
export type CreateQuizResponse = z.infer<typeof createQuizResponseSchema>;

/** GET /party/:partyId/quizzes のパスパラメータ */
export const listQuizzesParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type ListQuizzesParams = z.infer<typeof listQuizzesParamsSchema>;

/** GET /party/:partyId/quizzes のレスポンスボディ */
export const listQuizzesResponseSchema = z.object({
  quizzes: z.array(
    quizBaseSchema.and(
      z.object({ questionCount: z.number().int().nonnegative() }),
    ),
  ),
});
export type ListQuizzesResponse = z.infer<typeof listQuizzesResponseSchema>;

const questionBaseSchema = z.object({
  id: z.string().uuid(),
  displayOrder: z.number().int().nonnegative(),
  timeLimitSeconds: z.number().int().positive(),
  /** true の場合は当日に正解を決める（このとき全選択肢の isCorrect は null） */
  isAnswerDecidedOnDay: z.boolean(),
});

/** 選択肢（テキストのみ）— 写真が問題側のとき */
const textChoiceSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean().nullable(),
});

/** 選択肢（写真+テキスト）— 写真が選択肢側のとき */
const photoTextChoiceSchema = textChoiceSchema.extend({
  /** choice_*_image_key から生成した presigned URL */
  imageUrl: z.string().url(),
});

/**
 * 問題文のテキストサイズ
 * - `small`: 小
 * - `medium`: 中
 * - `large`: 大
 */
export const questionTextSizeSchema = z.enum(["small", "medium", "large"]);
export type QuestionTextSize = z.infer<typeof questionTextSizeSchema>;

const photoTextQuestionContentSchema = z.object({
  text: z.string(),
  textSize: questionTextSizeSchema,
  /** question_image_key から生成した presigned URL */
  imageUrl: z.string().url(),
});

const textQuestionContentSchema = z.object({
  text: z.string(),
  textSize: questionTextSizeSchema,
});

const twoChoicePhotoTextQuestionSchema = questionBaseSchema.extend({
  questionType: z.literal("two_choice_photo_text_question"),
  question: photoTextQuestionContentSchema,
  choices: z.object({ a: textChoiceSchema, b: textChoiceSchema }),
});

const fourChoicePhotoTextQuestionSchema = questionBaseSchema.extend({
  questionType: z.literal("four_choice_photo_text_question"),
  question: photoTextQuestionContentSchema,
  choices: z.object({
    a: textChoiceSchema,
    b: textChoiceSchema,
    c: textChoiceSchema,
    d: textChoiceSchema,
  }),
});

const twoChoicePhotoTextAnswerSchema = questionBaseSchema.extend({
  questionType: z.literal("two_choice_photo_text_answer"),
  question: textQuestionContentSchema,
  choices: z.object({ a: photoTextChoiceSchema, b: photoTextChoiceSchema }),
});

const fourChoicePhotoTextAnswerSchema = questionBaseSchema.extend({
  questionType: z.literal("four_choice_photo_text_answer"),
  question: textQuestionContentSchema,
  choices: z.object({
    a: photoTextChoiceSchema,
    b: photoTextChoiceSchema,
    c: photoTextChoiceSchema,
    d: photoTextChoiceSchema,
  }),
});

export const quizQuestionSchema = z.discriminatedUnion("questionType", [
  twoChoicePhotoTextQuestionSchema,
  fourChoicePhotoTextQuestionSchema,
  twoChoicePhotoTextAnswerSchema,
  fourChoicePhotoTextAnswerSchema,
]);
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

/** GET /party/:partyId/quizzes/:quizId のパスパラメータ */
export const getQuizParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type GetQuizParams = z.infer<typeof getQuizParamsSchema>;

/** GET /party/:partyId/quizzes/:quizId のレスポンスボディ */
export const getQuizResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  durationMinutes: z.number().int().positive(),
  playMode: quizPlayModeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  /** displayOrder 昇順 */
  questions: z.array(quizQuestionSchema),
});
export type GetQuizResponse = z.infer<typeof getQuizResponseSchema>;

/** DELETE /party/:partyId/quizzes/:quizId のパスパラメータ */
export const deleteQuizParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type DeleteQuizParams = z.infer<typeof deleteQuizParamsSchema>;

/** DELETE /party/:partyId/quizzes/:quizId のレスポンスボディ */
export const deleteQuizResponseSchema = z.object({});
export type DeleteQuizResponse = z.infer<typeof deleteQuizResponseSchema>;
