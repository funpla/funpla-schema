import { z } from "zod/v3";
import { questionTextSizeSchema, quizPlayModeSchema } from "./quiz";

// ══════════════════════════════════════════════════════════════════════════
// クイズ実行(Durable Object)用スキーマ
//
// クイズの「実行セッション」は Cloudflare Durable Object 1 インスタンスで表す。
// セッションキーは初期化時に crypto.randomUUID() で採番する sessionId（DO は
// idFromName(sessionId)）。同じクイズを何度でも実行でき、実行ごとに別セッションになる。
// 3 つの画面がぶら下がる:
//   - 操作画面(host)     : Clerk 認証済み。進行コマンドを送る
//   - 再生画面(display)   : 受信専用。現在の状態を描画するだけ
//   - 参加画面(participant): QR 経由の匿名。回答を送る
//
// スキーマはロールごとに「送信(Client→Server)」と「受信(Server→Client)」を
// セットで定義し、そのロールに必要な最小限だけを持たせる。
//   - ロールは接続時に確定するので、各接続は自分のロールのスキーマだけで検証する
//     （参加者が host コマンドを送れない／参加者に他人のスコア一覧を渡さない）。
//
// 参加(join)は WebSocket 接続に統合した単一フロー（HTTP join は持たない）。
// participantId はクライアントが crypto.randomUUID() で採番し localStorage に保存、
// 毎回 WS 接続クエリに付ける。handleName は初回（participantId 未登録）だけ渡す。
//   WS 接続 /game/quiz/:id?participantId=<uuid>[&handleName=<初回のみ>]
//     - participantId が storage に存在      → 復帰（rejoin）。handleName は無視
//     - 未登録 + handleName あり              → 新規登録（＝以後 handleName 変更不可）
//     - 未登録 + handleName なし              → 拒否（error 送信 → close）
//   接続確立後にサーバーが最初に送る participant state が実質の参加応答になる。
//
// セッションの初期化:
//   DO はコールドスタート時 storage が空。実行前にクイズデータ（全問 + 正解 +
//   画像URL）を storage に永続化しておく必要がある。ただしこれは独立フェーズにはしない
//   （外から完成済みデータを注入するだけで、DO 側に非同期の読み込み期間はない）。
//   - トリガーは host（操作画面）。正解込みのオーナー限定データを読むため認証必須で、
//     匿名の participant にセッションを立ち上げさせない。
//   - DO 自身は DB を叩かず、Worker（既存 infra 層）が QuizDetail を読み込んで DO の
//     initialize（HTTP → RPC）に注入 → DO が storage に保存し phase = lobby を確立。
//     （注入内容は BE 内部の受け渡しなのでこの共有スキーマには含めない）
//   - 初期化は接続の前提条件。WS 接続時に「init が storage に書いたデータの有無」で
//     初期化済みか判定し、未初期化ならハンドシェイクで拒否（404/409）。DO オブジェクトの
//     存在ではなく ctx.storage を見る（アクセスで DO は必ず生成されるため）。
//   - sessionId は init 時に採番され QR も start レスポンスで生成されるので、参加者は
//     init 後にしか sessionId を知り得ない。未初期化接続は異常系（防御ガード）。
//   - よって lobby は「初期化済み・開始待ち」を意味する（init 前を lobby として見せることはない）。
//
// 1 問のフェーズ遷移:
//   question   問題文のみ表示（選択肢データは配信済みだが非表示）
//     ↓ [host] start_countdown
//   answering  選択肢を表示 + カウントダウン + 回答受付（endsAt をセット）
//     ↓ カウントダウン 0（DO の alarm で自動）
//   closed     締切
//     ↓ [host] reveal（当日確定は set_correct_answer 済みが前提）
//   revealed   正解 + 結果を表示
//     ↓ [host] next_question（最後なら finished）
//
// ※ 正解(correctChoice)は participant / display には revealed になるまで配信しない。
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// 共通の部品
// ══════════════════════════════════════════════════════════════════════════

/** 選択肢キー */
export const choiceKeySchema = z.enum(["a", "b", "c", "d"]);
export type ChoiceKey = z.infer<typeof choiceKeySchema>;

const twoChoiceKeySchema = z.enum(["a", "b"]);
const fourChoiceKeySchema = z.enum(["a", "b", "c", "d"]);

/**
 * 「questionType に応じて choice の値域が変わる」メッセージのスキーマを、
 * 指定した type リテラルで生成するファクトリ。
 * submit_answer（参加者の回答）と set_correct_answer（当日確定の正解セット）が
 * 同一構造なので共通化する。2 択には c/d を送れない。
 */
const choiceByQuestionTypeSchema = <T extends string>(type: T) =>
  z.discriminatedUnion("questionType", [
    z.object({
      type: z.literal(type),
      questionType: z.literal("two_choice_photo_text_question"),
      choice: twoChoiceKeySchema,
    }),
    z.object({
      type: z.literal(type),
      questionType: z.literal("two_choice_photo_text_answer"),
      choice: twoChoiceKeySchema,
    }),
    z.object({
      type: z.literal(type),
      questionType: z.literal("four_choice_photo_text_question"),
      choice: fourChoiceKeySchema,
    }),
    z.object({
      type: z.literal(type),
      questionType: z.literal("four_choice_photo_text_answer"),
      choice: fourChoiceKeySchema,
    }),
  ]);

/** セッションのフェーズ */
export const quizSessionPhaseSchema = z.enum([
  "lobby", // 参加募集中（QR 表示）。初期化済み・開始待ち。まだ最初の問題に入っていない
  "question", // 問題文表示（選択肢は非表示）
  "answering", // 選択肢表示・カウントダウン中・回答受付
  "closed", // 締切（正解はまだ出さない）
  "revealed", // 正解オープン・結果表示
  "finished", // 全問終了
]);
export type QuizSessionPhase = z.infer<typeof quizSessionPhaseSchema>;

// ── 配信用の問題（正解 isCorrect は含めない）─────────────────────────────
//
// 参加画面は匿名で、クイズ詳細（オーナー限定）を取得できないため、DO が
// 問題内容を配信する。正誤は含めず、正解は別途 correctChoice で revealed 時のみ。

const publicTextChoiceSchema = z.object({ text: z.string() });
const publicPhotoTextChoiceSchema = z.object({
  text: z.string(),
  /** 表示用 presigned URL */
  imageUrl: z.string().url(),
});

const publicPhotoTextQuestionContentSchema = z.object({
  text: z.string(),
  textSize: questionTextSizeSchema,
  imageUrl: z.string().url(),
});
const publicTextQuestionContentSchema = z.object({
  text: z.string(),
  textSize: questionTextSizeSchema,
});

const publicQuestionBaseSchema = z.object({
  id: z.string().uuid(),
  displayOrder: z.number().int().nonnegative(),
  timeLimitSeconds: z.number().int().positive(),
  isAnswerDecidedOnDay: z.boolean(),
});

/** 配信用の 1 問（getQuizResponse の question から isCorrect を除いた形） */
export const publicQuizQuestionSchema = z.discriminatedUnion("questionType", [
  publicQuestionBaseSchema.extend({
    questionType: z.literal("two_choice_photo_text_question"),
    question: publicPhotoTextQuestionContentSchema,
    choices: z.object({ a: publicTextChoiceSchema, b: publicTextChoiceSchema }),
  }),
  publicQuestionBaseSchema.extend({
    questionType: z.literal("four_choice_photo_text_question"),
    question: publicPhotoTextQuestionContentSchema,
    choices: z.object({
      a: publicTextChoiceSchema,
      b: publicTextChoiceSchema,
      c: publicTextChoiceSchema,
      d: publicTextChoiceSchema,
    }),
  }),
  publicQuestionBaseSchema.extend({
    questionType: z.literal("two_choice_photo_text_answer"),
    question: publicTextQuestionContentSchema,
    choices: z.object({
      a: publicPhotoTextChoiceSchema,
      b: publicPhotoTextChoiceSchema,
    }),
  }),
  publicQuestionBaseSchema.extend({
    questionType: z.literal("four_choice_photo_text_answer"),
    question: publicTextQuestionContentSchema,
    choices: z.object({
      a: publicPhotoTextChoiceSchema,
      b: publicPhotoTextChoiceSchema,
      c: publicPhotoTextChoiceSchema,
      d: publicPhotoTextChoiceSchema,
    }),
  }),
]);
export type PublicQuizQuestion = z.infer<typeof publicQuizQuestionSchema>;

/** すべての受信 state に共通する骨格 */
const sessionStateBaseSchema = z.object({
  type: z.literal("state"),
  phase: quizSessionPhaseSchema,
  /** クイズ名 */
  quizName: z.string(),
  /** プレイモード（solo / team）。表示に使う。状態や採点には影響しない */
  playMode: quizPlayModeSchema,
  /** 現在の問題番号（0 始まり）。lobby では 0 */
  questionIndex: z.number().int().nonnegative(),
  totalQuestions: z.number().int().nonnegative(),
  /** question 以降で載る問題内容。lobby / finished では null */
  question: publicQuizQuestionSchema.nullable(),
  /** answering のときの回答締切時刻(ISO)。残り秒は各自が算出。それ以外は null */
  endsAt: z.string().datetime().nullable(),
});

/** ランキング表示用の参加者サマリ（host / display のみ。participantId は含めない） */
export const quizSessionParticipantSchema = z.object({
  handleName: z.string(),
  /** 累計スコア（トータルのみ保持） */
  score: z.number().int().nonnegative(),
  /** 現在 WebSocket 接続中か */
  connected: z.boolean(),
});
export type QuizSessionParticipant = z.infer<
  typeof quizSessionParticipantSchema
>;

/** エラーコード（受信は全ロール共通） */
export const quizSessionErrorCodeSchema = z.enum([
  "invalid_phase", // そのフェーズでは受理できないコマンド
  "not_accepting_answers", // answering 以外での回答
  "already_answered", // 現在の問題に回答済み
  "correct_answer_required", // 当日確定で正解未セットのまま reveal
  "invalid_choice", // 存在しない選択肢
  "invalid_participant", // 未知の participantId
  "forbidden", // ロール権限がない（例: participant が host コマンド）
]);
export type QuizSessionErrorCode = z.infer<typeof quizSessionErrorCodeSchema>;

/** エラー通知（送信元にのみ返す） */
export const quizSessionErrorSchema = z.object({
  type: z.literal("error"),
  code: quizSessionErrorCodeSchema,
  message: z.string(),
});
export type QuizSessionError = z.infer<typeof quizSessionErrorSchema>;

// ══════════════════════════════════════════════════════════════════════════
// WebSocket 接続（ロールでパスを分ける）
//
// 認証の当て方が違うのでパスを分離する:
//   participant : GET /game/quiz/:id                                  （匿名, sessionId キー）
//   host        : GET /party/:partyId/quizzes/:quizId/session/host    （Clerk, quizId → sessionId 解決）
//   display     : GET /party/:partyId/quizzes/:quizId/session/display （Clerk, quizId → sessionId 解決）
//
// host / display は /party 配下なので既存 Clerk 認証ミドルウェア（＋オーナー検証）がそのまま効く。
// quizId で接続し、Worker が quiz_sessions から現在の sessionId を解決して同じ DO に繋ぐ。
// ══════════════════════════════════════════════════════════════════════════

// ── participant（匿名, /game/quiz/:id）─────────────────────────────────────

/**
 * participant の WebSocket 接続先 /game/quiz/:id のパスパラメータ。
 * id = 初期化時に crypto.randomUUID() で採番したクイズセッションID（QR に埋め込む）。
 */
export const participantConnectParamsSchema = z.object({
  id: z.string().uuid(),
});
export type ParticipantConnectParams = z.infer<
  typeof participantConnectParamsSchema
>;

/**
 * participant の WebSocket 接続クエリ。HTTP join は廃止し、接続に統合した単一フロー。
 * - participantId: クライアントが crypto.randomUUID() で採番し localStorage に保存。毎回必ず付ける
 * - handleName: participantId が storage に未登録のとき（新規参加）だけ受け取り反映する。
 *   既存 participantId の再参加では無視する（＝ハンドルネームは変更不可）。
 *   未登録なのに handleName が無い場合はサーバーが接続を拒否（error → close）。
 *
 * 接続確立後、サーバーが最初に送る participant state が実質の参加応答になる。
 * ブラウザはクエリにカスタムヘッダを付けられないため participantId はクエリで渡す。
 */
export const participantConnectQuerySchema = z.object({
  participantId: z.string().uuid(),
  handleName: z.string().min(1).max(20).optional(),
});
export type ParticipantConnectQuery = z.infer<
  typeof participantConnectQuerySchema
>;

// ── host / display（Clerk, /party/:partyId/quizzes/:quizId/session/*）───────

/** host の WebSocket 接続先 /party/:partyId/quizzes/:quizId/session/host のパスパラメータ */
export const hostConnectParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type HostConnectParams = z.infer<typeof hostConnectParamsSchema>;

/** display の WebSocket 接続先 /party/:partyId/quizzes/:quizId/session/display のパスパラメータ */
export const displayConnectParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type DisplayConnectParams = z.infer<typeof displayConnectParamsSchema>;

// ══════════════════════════════════════════════════════════════════════════
// HTTP: host によるセッション start / end / 現在取得（Clerk 認証）
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /party/:partyId/quizzes/:quizId/session のパスパラメータ。
 * quizId の現在の実行中セッションを取得する。start が sessionId を返さないため、
 * 操作画面・QR 表示はこれで sessionId を得る（quiz_sessions を読む）。
 */
export const getQuizSessionParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type GetQuizSessionParams = z.infer<typeof getQuizSessionParamsSchema>;

/**
 * GET /party/:partyId/quizzes/:quizId/session のレスポンス。
 * 実行中セッションが無ければ sessionId は null（未 start）。
 */
export const getQuizSessionResponseSchema = z.object({
  sessionId: z.string().uuid().nullable(),
});
export type GetQuizSessionResponse = z.infer<
  typeof getQuizSessionResponseSchema
>;

/**
 * POST /party/:partyId/quizzes/:quizId/session/start のパスパラメータ。
 * sessionId を採番して DO 初期化を起動する。既に実行中なら既存 sessionId へ復帰する。
 */
export const startQuizSessionParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type StartQuizSessionParams = z.infer<
  typeof startQuizSessionParamsSchema
>;

/**
 * POST /party/:partyId/quizzes/:quizId/session/start のレスポンス。
 * 採番（または復帰した既存の）sessionId を返す。呼び出し側はこれで QR URL
 * /game/quiz/:id を生成し、WebSocket 接続に使う。
 */
export const startQuizSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
});
export type StartQuizSessionResponse = z.infer<
  typeof startQuizSessionResponseSchema
>;

/**
 * POST /party/:partyId/quizzes/:quizId/session/end のパスパラメータ。
 * quiz_sessions レコード削除 + DO 掃除を起動する。
 */
export const endQuizSessionParamsSchema = z.object({
  partyId: z.string().uuid(),
  quizId: z.string().uuid(),
});
export type EndQuizSessionParams = z.infer<typeof endQuizSessionParamsSchema>;

// ══════════════════════════════════════════════════════════════════════════
// host（操作画面）: 送信 = コマンド / 受信 = 進行用の state
// ══════════════════════════════════════════════════════════════════════════

// ── 送信（Client → Server）─────────────────────────────────────────────────

/** カウントダウン開始（question → answering。選択肢を表示し受付開始） */
const startCountdownSchema = z.object({ type: z.literal("start_countdown") });

/** 答えをオープン（closed → revealed）。当日確定で正解未セットなら拒否される */
const revealSchema = z.object({ type: z.literal("reveal") });

/** 次の問題へ（revealed → 次の question。最後なら finished） */
const nextQuestionSchema = z.object({ type: z.literal("next_question") });

/**
 * 当日確定の正解をセット（answering / closed で受理）。
 * questionType を一緒に送り choice の値域を制約する（2 択に c/d をセットできない）。
 */
export const quizSessionSetCorrectAnswerSchema =
  choiceByQuestionTypeSchema("set_correct_answer");
export type QuizSessionSetCorrectAnswer = z.infer<
  typeof quizSessionSetCorrectAnswerSchema
>;

/** type で判別できる単純な host コマンド（set_correct_answer 以外） */
const simpleHostCommandSchema = z.discriminatedUnion("type", [
  startCountdownSchema,
  revealSchema,
  nextQuestionSchema,
]);

/** host（操作画面）が送るコマンド */
export const quizSessionHostCommandSchema = z.union([
  simpleHostCommandSchema,
  quizSessionSetCorrectAnswerSchema,
]);
export type QuizSessionHostCommand = z.infer<
  typeof quizSessionHostCommandSchema
>;

// ── 受信（Server → Client）─────────────────────────────────────────────────

/**
 * host 受信 state。進行に必要な情報を持つ。
 * correctChoice は host には既知の正解を随時見せる（通常問題は常に、当日確定は
 * set_correct_answer 後）。これにより reveal 可否や「正解: B」を表示できる。
 */
export const quizSessionHostStateSchema = sessionStateBaseSchema.extend({
  correctChoice: choiceKeySchema.nullable(),
  /** 現在の問題への回答者数 */
  answeredCount: z.number().int().nonnegative(),
  /** 参加者一覧（ランキング用） */
  participants: z.array(quizSessionParticipantSchema),
});
export type QuizSessionHostState = z.infer<typeof quizSessionHostStateSchema>;

/** host が受信する全メッセージ */
export const quizSessionHostServerMessageSchema = z.discriminatedUnion("type", [
  quizSessionHostStateSchema,
  quizSessionErrorSchema,
]);
export type QuizSessionHostServerMessage = z.infer<
  typeof quizSessionHostServerMessageSchema
>;

// ══════════════════════════════════════════════════════════════════════════
// participant（参加画面）: 送信 = 回答 / 受信 = 自分視点の state
// ══════════════════════════════════════════════════════════════════════════

// ── 送信（Client → Server）─────────────────────────────────────────────────

/**
 * 回答送信。questionType を一緒に送り、選択肢数に応じて choice の値域を制約する
 * （2 択に c/d を送れない）。answering フェーズのみ受理。
 * 現状 participant が送るメッセージはこれのみ。
 */
export const quizSessionSubmitAnswerSchema =
  choiceByQuestionTypeSchema("submit_answer");
export type QuizSessionSubmitAnswer = z.infer<
  typeof quizSessionSubmitAnswerSchema
>;

// ── 受信（Server → Client）─────────────────────────────────────────────────

/**
 * participant 受信 state。自分視点の最小限のみ。
 * 他人のスコア一覧（roster）は渡さない。correctChoice は revealed のみ非 null。
 */
export const quizSessionParticipantStateSchema = sessionStateBaseSchema.extend({
  /**
   * 自分のハンドルネーム（サーバー保管値）。
   * 再接続時は participantId しか持たずクライアントが handleName を復元できないため、
   * state に含めて返す。
   */
  handleName: z.string(),
  /** revealed のときの正解。それ以外は null（正解の秘匿） */
  correctChoice: choiceKeySchema.nullable(),
  /** 自分の累計スコア */
  score: z.number().int().nonnegative(),
  /**
   * 現在の問題に対して自分が選んだ選択肢。未回答なら null。
   * 再接続時に「どれを選択済みか」を復元できるよう、boolean ではなく選択肢そのものを返す。
   */
  currentChoice: choiceKeySchema.nullable(),
});
export type QuizSessionParticipantState = z.infer<
  typeof quizSessionParticipantStateSchema
>;

/** participant が受信する全メッセージ */
export const quizSessionParticipantServerMessageSchema = z.discriminatedUnion(
  "type",
  [quizSessionParticipantStateSchema, quizSessionErrorSchema],
);
export type QuizSessionParticipantServerMessage = z.infer<
  typeof quizSessionParticipantServerMessageSchema
>;

// ══════════════════════════════════════════════════════════════════════════
// display（再生画面）: 送信なし / 受信 = 投影用の state
// ══════════════════════════════════════════════════════════════════════════

/**
 * display 受信 state。投影して見せる情報のみ。送信スキーマは持たない（受信専用）。
 * correctChoice は revealed のみ非 null。
 */
export const quizSessionDisplayStateSchema = sessionStateBaseSchema.extend({
  /** revealed のときの正解。それ以外は null（正解の秘匿） */
  correctChoice: choiceKeySchema.nullable(),
  /** 現在の問題への回答者数 */
  answeredCount: z.number().int().nonnegative(),
  /** 参加者一覧（ランキング表示用） */
  participants: z.array(quizSessionParticipantSchema),
});
export type QuizSessionDisplayState = z.infer<
  typeof quizSessionDisplayStateSchema
>;

/** display が受信する全メッセージ */
export const quizSessionDisplayServerMessageSchema = z.discriminatedUnion(
  "type",
  [quizSessionDisplayStateSchema, quizSessionErrorSchema],
);
export type QuizSessionDisplayServerMessage = z.infer<
  typeof quizSessionDisplayServerMessageSchema
>;
