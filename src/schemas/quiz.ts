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

/**
 * メディア種別
 * - `image`: 画像
 * - `video`: 動画
 *
 * 問題文（写真が問題側の種別）の imageKey / imageUrl が指す R2 オブジェクトが
 * 画像か動画かを表す。FE は描画時にこの値で `<img>` / `<video>` を切り替える。
 * 選択肢（写真が選択肢側の種別）は画像のみのため mediaType を持たない。
 */
export const mediaTypeSchema = z.enum(["image", "video"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

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

/**
 * POST /party/:partyId/quizzes のレスポンスボディ
 *
 * 作成済みのクイズ数がパーティーの作成上限（`maxQuizCount`）に達している場合は 409 を返す。
 */
export const createQuizResponseSchema = z.object({ id: z.string().uuid() });
export type CreateQuizResponse = z.infer<typeof createQuizResponseSchema>;

/** GET /party/:partyId/quizzes のパスパラメータ */
export const listQuizzesParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type ListQuizzesParams = z.infer<typeof listQuizzesParamsSchema>;

/**
 * GET /party/:partyId/quizzes のレスポンスボディ
 * - `maxQuizCount`: このパーティーで作成できるクイズ数の上限。
 *   基本の 1 個に、作成枠の購入（POST /party/:partyId/quizzes/slots/checkout）で増えた分を足した値。
 *   クイズを削除すると枠が空くため、`quizzes.length < maxQuizCount` なら作成できる。
 */
export const listQuizzesResponseSchema = z.object({
  quizzes: z.array(
    quizBaseSchema.and(
      z.object({ questionCount: z.number().int().nonnegative() }),
    ),
  ),
  maxQuizCount: z.number().int().positive(),
});
export type ListQuizzesResponse = z.infer<typeof listQuizzesResponseSchema>;

// ── クイズ作成枠の購入（POST /party/:partyId/quizzes/slots/checkout） ──
//
// パーティーごとのクイズ作成上限（基本 1 個）を、1 枠 1,000 円（税込）の個別課金で増やす。
// Stripe Checkout の決済ページ URL を返すだけで、枠の付与は決済完了の webhook で行う。
// 購入した枠はそのパーティーに永続的に加算され、クイズを削除しても減らない。

/** POST /party/:partyId/quizzes/slots/checkout のパスパラメータ */
export const purchaseQuizSlotsParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type PurchaseQuizSlotsParams = z.infer<
  typeof purchaseQuizSlotsParamsSchema
>;

/**
 * POST /party/:partyId/quizzes/slots/checkout のリクエストボディ
 * - `slotCount`: 購入する作成枠の数（1 枠 = 1,000 円）。1 回の購入は最大 10 枠まで。
 * - `successUrl`: 決済成功後に Stripe から戻る URL。購入した画面へ戻すためにクライアントが指定する。
 * - `cancelUrl`: 決済キャンセル後に Stripe から戻る URL。同上。
 *   オープンリダイレクト防止のため、バックエンドは自オリジンの URL かどうかを検証すること。
 */
export const purchaseQuizSlotsRequestSchema = z.object({
  slotCount: z.number().int().positive().max(10),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type PurchaseQuizSlotsRequest = z.infer<
  typeof purchaseQuizSlotsRequestSchema
>;

/**
 * POST /party/:partyId/quizzes/slots/checkout のレスポンスボディ
 * - `url`: 決済ページの URL
 */
export const purchaseQuizSlotsResponseSchema = z.object({ url: z.string() });
export type PurchaseQuizSlotsResponse = z.infer<
  typeof purchaseQuizSlotsResponseSchema
>;

const questionBaseSchema = z.object({
  id: z.string().uuid(),
  displayOrder: z.number().int().nonnegative(),
  /** 回答の制限時間（秒）。null の場合は無制限（カウントダウンなし・手動で締切/オープン） */
  timeLimitSeconds: z.number().int().positive().nullable(),
  /** true の場合は当日に正解を決める（このとき全選択肢の isCorrect は null） */
  isAnswerDecidedOnDay: z.boolean(),
});

/** 選択肢（テキストのみ）— 写真が問題側のとき */
const textChoiceSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean().nullable(),
});

/** 正解発表時に差し替える選択肢画像（選択肢は画像のみ） */
const revealChoiceImageSchema = z.object({
  /** 保存・編集で使う正準値 */
  imageKey: z.string(),
  /** imageKey から生成した表示用 presigned URL */
  imageUrl: z.string().url(),
});

/** 選択肢（写真+テキスト）— 写真が選択肢側のとき（選択肢は画像のみ） */
const photoTextChoiceSchema = textChoiceSchema.extend({
  /** 保存・編集で使う正準値（choice_*_image_key） */
  imageKey: z.string(),
  /** imageKey から生成した表示用 presigned URL */
  imageUrl: z.string().url(),
  /** 正解発表時に差し替える画像。null なら差し替えず imageUrl のまま表示する */
  revealImage: revealChoiceImageSchema.nullable(),
});

/**
 * 問題文のテキストサイズ
 * - `small`: 小
 * - `medium`: 中
 * - `large`: 大
 */
export const questionTextSizeSchema = z.enum(["small", "medium", "large"]);
export type QuestionTextSize = z.infer<typeof questionTextSizeSchema>;

/** 正解発表時に差し替える問題のメディア（画像 / 動画） */
const revealQuestionMediaSchema = z.object({
  mediaType: mediaTypeSchema,
  /** 保存・編集で使う正準値 */
  imageKey: z.string(),
  /** imageKey から生成した表示用 presigned URL */
  imageUrl: z.string().url(),
});

const photoTextQuestionContentSchema = z.object({
  text: z.string(),
  textSize: questionTextSizeSchema,
  /** imageKey が指すメディアの種別（画像 / 動画） */
  mediaType: mediaTypeSchema,
  /** 保存・編集で使う正準値（question_image_key） */
  imageKey: z.string(),
  /** imageKey から生成した表示用 presigned URL */
  imageUrl: z.string().url(),
  /** 正解発表時に差し替えるメディア。null なら差し替えず imageUrl のまま表示する */
  revealMedia: revealQuestionMediaSchema.nullable(),
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

// ── クイズ質問の編集（PUT /party/:partyId/quizzes/:quizId/questions） ──
//
// 差分送信はせず「最終状態の全質問」を送り、サーバーが id 突き合わせ
// （reconcile）で新規/更新/削除を判定する方式。
// - 新規は id 無しで送信（サーバーが採番）、id ありは既存の更新。
// - questionType の変更は「削除＋新規」で表現するため、既存 id の
//   questionType はサーバー側で不変前提として扱う。
// - 入力では画像を presigned URL ではなく R2 の key（imageKey）で受け取る。
// - 表示順は displayOrder で明示的に送る。
// - 正解発表時の差し替えメディアも key で受け取る。null は「差し替えない」。
//   設定画面のトグルは保存せず、差し替えメディアの有無で表す
//   （写真＝問題は question.revealMedia、写真＝選択肢は各 choice の revealImageKey）。

/** 選択肢（テキストのみ）入力 — 写真が問題側のとき */
const textChoiceInputSchema = z.object({
  text: z.string(),
  /** 当日確定（isAnswerDecidedOnDay=true）なら null */
  isCorrect: z.boolean().nullable(),
});

/** 選択肢（写真+テキスト）入力 — 写真が選択肢側のとき（選択肢は画像のみ） */
const photoTextChoiceInputSchema = textChoiceInputSchema.extend({
  imageKey: z.string(),
  /** 正解発表時に差し替える画像の key。null なら差し替えない */
  revealImageKey: z.string().nullable(),
});

/** 問題文（テキストのみ）入力 — 写真が選択肢側の種別 */
const textQuestionContentInputSchema = z.object({
  text: z.string(),
  textSize: questionTextSizeSchema,
});

/** 問題文（写真+テキスト）入力 — 写真が問題側の種別 */
const photoTextQuestionContentInputSchema =
  textQuestionContentInputSchema.extend({
    /** imageKey が指すメディアの種別（画像 / 動画） */
    mediaType: mediaTypeSchema,
    imageKey: z.string(),
    /** 正解発表時に差し替えるメディア。null なら差し替えない */
    revealMedia: z
      .object({ mediaType: mediaTypeSchema, imageKey: z.string() })
      .nullable(),
  });

const questionInputBaseSchema = z.object({
  /** 省略 = 新規、あり = 既存の更新 */
  id: z.string().uuid().optional(),
  /** 表示順（0 始まり） */
  displayOrder: z.number().int().nonnegative(),
  /** 回答の制限時間（秒）。null の場合は無制限（カウントダウンなし・手動で締切/オープン） */
  timeLimitSeconds: z.number().int().positive().nullable(),
  /** true の場合は当日に正解を決める（このとき全選択肢の isCorrect は null） */
  isAnswerDecidedOnDay: z.boolean(),
});

const twoChoicePhotoTextQuestionInputSchema = questionInputBaseSchema.extend({
  questionType: z.literal("two_choice_photo_text_question"),
  question: photoTextQuestionContentInputSchema,
  choices: z.object({ a: textChoiceInputSchema, b: textChoiceInputSchema }),
});

const fourChoicePhotoTextQuestionInputSchema = questionInputBaseSchema.extend({
  questionType: z.literal("four_choice_photo_text_question"),
  question: photoTextQuestionContentInputSchema,
  choices: z.object({
    a: textChoiceInputSchema,
    b: textChoiceInputSchema,
    c: textChoiceInputSchema,
    d: textChoiceInputSchema,
  }),
});

const twoChoicePhotoTextAnswerInputSchema = questionInputBaseSchema.extend({
  questionType: z.literal("two_choice_photo_text_answer"),
  question: textQuestionContentInputSchema,
  choices: z.object({
    a: photoTextChoiceInputSchema,
    b: photoTextChoiceInputSchema,
  }),
});

const fourChoicePhotoTextAnswerInputSchema = questionInputBaseSchema.extend({
  questionType: z.literal("four_choice_photo_text_answer"),
  question: textQuestionContentInputSchema,
  choices: z.object({
    a: photoTextChoiceInputSchema,
    b: photoTextChoiceInputSchema,
    c: photoTextChoiceInputSchema,
    d: photoTextChoiceInputSchema,
  }),
});

const quizQuestionInputSchema = z.discriminatedUnion("questionType", [
  twoChoicePhotoTextQuestionInputSchema,
  fourChoicePhotoTextQuestionInputSchema,
  twoChoicePhotoTextAnswerInputSchema,
  fourChoicePhotoTextAnswerInputSchema,
]);
export type QuizQuestionInput = z.infer<typeof quizQuestionInputSchema>;

/** PUT /party/:partyId/quizzes/:quizId/questions のパスパラメータ */
export const updateQuizQuestionsParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type UpdateQuizQuestionsParams = z.infer<
  typeof updateQuizQuestionsParamsSchema
>;

/**
 * PUT /party/:partyId/quizzes/:quizId/questions のリクエストボディ
 *
 * 問題編集と同時にクイズの基本設定（name / durationMinutes / playMode）も更新する。
 * 表示順は各質問の displayOrder で明示的に指定する。質問数の上限は設けない。
 * 「当日確定 ↔ isCorrect」の整合は discriminated union で表せないため superRefine で検証する。
 */
export const updateQuizQuestionsRequestSchema = quizBaseSchema
  .pick({
    name: true,
    durationMinutes: true,
    playMode: true,
  })
  .extend({
    questions: z
      .array(quizQuestionInputSchema)
      .min(1, "質問を最低1つ指定してください")
      .superRefine((questions, ctx) => {
        questions.forEach((q, i) => {
          const choices = Object.values(q.choices);
          if (q.isAnswerDecidedOnDay) {
            // 当日確定: isCorrect は全て null
            if (choices.some((c) => c.isCorrect !== null)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [i, "choices"],
                message: "当日確定の質問では isCorrect を null にしてください",
              });
            }
          } else {
            // 事前確定: 最低1つは true
            if (!choices.some((c) => c.isCorrect === true)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [i, "choices"],
                message: "正解を最低1つ指定してください",
              });
            }
          }
        });
      }),
  });
export type UpdateQuizQuestionsRequest = z.infer<
  typeof updateQuizQuestionsRequestSchema
>;

/** PUT /party/:partyId/quizzes/:quizId/questions のレスポンスボディ */
export const updateQuizQuestionsResponseSchema = z.object({});
export type UpdateQuizQuestionsResponse = z.infer<
  typeof updateQuizQuestionsResponseSchema
>;

/** DELETE /party/:partyId/quizzes/:quizId のパスパラメータ */
export const deleteQuizParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type DeleteQuizParams = z.infer<typeof deleteQuizParamsSchema>;

/** DELETE /party/:partyId/quizzes/:quizId のレスポンスボディ */
export const deleteQuizResponseSchema = z.object({});
export type DeleteQuizResponse = z.infer<typeof deleteQuizResponseSchema>;
