import { z } from "zod/v3";

/**
 * タイムテーブル（会の進行表）のスキーマ。
 *
 * 1 パーティーにつき 1 件。会の基本情報（会の種類・受付開始/開始/終了時刻・参加者数）と、
 * 進行内容であるプログラムの配列を持つ。主催者向けのみのリソースで、
 * すべて Clerk 認証あり（/party/:partyId 配下）。
 *
 * 各プログラムは開始時刻を持たず、displayOrder 昇順に durationMinutes を積み上げて算出する
 * （プログラム n の開始時刻 = receptionStartTime + それ以前のプログラムの durationMinutes 合計）。
 * ドラッグ＆ドロップでの並び替えは displayOrder の振り直しで表現する。
 */

// ── 共通 ──

/**
 * 会の種類（パーティーシーン）
 * - `farewell`: 送別会
 * - `year_end`: 忘年会
 * - `networking`: 交流会
 * - `wedding_after_party`: 結婚式二次会
 * - `graduation_send_off`: 追いコン
 * - `social_gathering`: 懇親会・親睦会
 * - `welcome`: 歓迎会
 * - `class_reunion`: 同窓会
 * - `alumni`: OB・OG会
 * - `offline_meetup`: オフ会
 * - `birthday`: 誕生日会
 * - `other`: その他（近しいパーティーシーンが選べない場合）
 */
export const partySceneTypeSchema = z.enum([
  "farewell",
  "year_end",
  "networking",
  "wedding_after_party",
  "graduation_send_off",
  "social_gathering",
  "welcome",
  "class_reunion",
  "alumni",
  "offline_meetup",
  "birthday",
  "other",
]);
export type PartySceneType = z.infer<typeof partySceneTypeSchema>;

/**
 * プログラム種別のうち、既定の名称を持つもの（表示名は種別からクライアントが解決する）
 * - `organizer_entry`: 幹事入場
 * - `party_start`: パーティースタート
 * - `couple_entry`: 新郎新婦入場
 * - `surprise_entry`: サプライズ入場
 * - `toast`: 乾杯
 * - `chat`: 歓談
 * - `bingo`: FunBINGO
 * - `quiz`: クイズ
 * - `movie`: ムービー・動画上映
 * - `performance`: 余興
 * - `self_introduction`: 自己紹介・PRタイム
 * - `status_report`: 現状報告・団体報告
 * - `present`: プレゼント贈呈
 * - `bouquet`: 花束贈呈
 * - `cake`: ケーキ吹き消し
 * - `greeting`: 挨拶
 * - `farewell_address`: 送辞
 * - `honoree_speech`: 送別者挨拶
 * - `closing_speech`: 締めの挨拶
 * - `group_photo`: 集合写真・記念撮影
 * - `exit`: 退出・ゲストお見送り
 */
export const standardTimetableProgramTypeSchema = z.enum([
  "organizer_entry",
  "party_start",
  "couple_entry",
  "surprise_entry",
  "toast",
  "chat",
  "bingo",
  "quiz",
  "movie",
  "performance",
  "self_introduction",
  "status_report",
  "present",
  "bouquet",
  "cake",
  "greeting",
  "farewell_address",
  "honoree_speech",
  "closing_speech",
  "group_photo",
  "exit",
]);
export type StandardTimetableProgramType = z.infer<
  typeof standardTimetableProgramTypeSchema
>;

/** プログラム種別。`custom` は表示名を自分で入力する項目 */
export const timetableProgramTypeSchema = z.enum([
  ...standardTimetableProgramTypeSchema.options,
  "custom",
]);
export type TimetableProgramType = z.infer<typeof timetableProgramTypeSchema>;

const timetableProgramBaseSchema = z.object({
  id: z.string().uuid(),
  /** 表示順（0 始まり）。この順に durationMinutes を積み上げて開始時刻を算出する */
  displayOrder: z.number().int().nonnegative(),
  /** 所要時間（分）。挨拶のように人数 × 目安時間で決まる項目も算出結果の分数を持つ */
  durationMinutes: z.number().int().positive(),
  /** 任意の備考・説明文。未入力は null */
  note: z.string().nullable(),
});

const standardTimetableProgramSchema = timetableProgramBaseSchema.extend({
  programType: standardTimetableProgramTypeSchema,
});

const customTimetableProgramSchema = timetableProgramBaseSchema.extend({
  programType: z.literal("custom"),
  /** カスタム項目の表示名 */
  title: z.string(),
});

export const timetableProgramSchema = z.discriminatedUnion("programType", [
  standardTimetableProgramSchema,
  customTimetableProgramSchema,
]);
export type TimetableProgram = z.infer<typeof timetableProgramSchema>;

// ── 取得（GET /party/:partyId/timetable） ──

/** GET /party/:partyId/timetable のパスパラメータ */
export const getTimetableParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type GetTimetableParams = z.infer<typeof getTimetableParamsSchema>;

/**
 * GET /party/:partyId/timetable のレスポンスボディ
 * - `partyName`: タイトルとして表示するパーティー名（編集不可）
 * - `programs`: displayOrder 昇順
 *
 * タイムテーブル未作成のパーティーでは 404 を返す（作成前の初期値はパーティー設定から埋める）。
 */
export const getTimetableResponseSchema = z.object({
  partyName: z.string(),
  partySceneType: partySceneTypeSchema,
  /** 受付開始時刻。プログラムはこの時刻から順に積み上がる */
  receptionStartTime: z.string().time({ precision: 0 }),
  /** 会の開始時刻（パーティースタート） */
  startTime: z.string().time({ precision: 0 }),
  /** 会の終了時刻。プログラム合計との差分が「残り時間」の基準になる */
  endTime: z.string().time({ precision: 0 }),
  guestCount: z.number().int().positive(),
  programs: z.array(timetableProgramSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GetTimetableResponse = z.infer<typeof getTimetableResponseSchema>;

// ── 編集（PUT /party/:partyId/timetable） ──
//
// 差分送信はせず「最終状態のタイムテーブル全体」を送り、サーバーはプログラムを
// 総入れ替えする（id は返却専用で、入力では送らない）。
// タイムテーブル未作成のパーティーに対しては、この PUT が作成も兼ねる。

const timetableProgramInputBaseSchema = z.object({
  /** 表示順（0 始まり・重複不可） */
  displayOrder: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive(),
  /** 任意の備考・説明文。未入力は null */
  note: z.string().max(200).nullable(),
});

const standardTimetableProgramInputSchema =
  timetableProgramInputBaseSchema.extend({
    programType: standardTimetableProgramTypeSchema,
  });

const customTimetableProgramInputSchema =
  timetableProgramInputBaseSchema.extend({
    programType: z.literal("custom"),
    title: z.string().min(1).max(50),
  });

const timetableProgramInputSchema = z.discriminatedUnion("programType", [
  standardTimetableProgramInputSchema,
  customTimetableProgramInputSchema,
]);
export type TimetableProgramInput = z.infer<typeof timetableProgramInputSchema>;

/** PUT /party/:partyId/timetable のパスパラメータ */
export const updateTimetableParamsSchema = z.object({
  partyId: z.string().uuid(),
});
export type UpdateTimetableParams = z.infer<typeof updateTimetableParamsSchema>;

/**
 * PUT /party/:partyId/timetable のリクエストボディ
 * - `partySceneType`: 会の種類
 * - `receptionStartTime` / `startTime` / `endTime`: 受付開始・開始・終了時刻
 * - `guestCount`: 参加者数
 * - `programs`: 最終状態のプログラム全件（0 件も可）。順序は displayOrder で明示する
 *
 * 時刻の前後関係（受付開始 ≦ 開始 < 終了）は日をまたぐ会もあるためサーバー側で検証する。
 */
export const updateTimetableRequestSchema = z.object({
  partySceneType: partySceneTypeSchema,
  receptionStartTime: z.string().time({ precision: 0 }),
  startTime: z.string().time({ precision: 0 }),
  endTime: z.string().time({ precision: 0 }),
  guestCount: z.number().int().positive(),
  programs: z
    .array(timetableProgramInputSchema)
    .superRefine((programs, ctx) => {
      const orders = programs.map((p) => p.displayOrder);
      if (new Set(orders).size !== orders.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "displayOrder が重複しています",
        });
      }
    }),
});
export type UpdateTimetableRequest = z.infer<
  typeof updateTimetableRequestSchema
>;

/** PUT /party/:partyId/timetable のレスポンスボディ */
export const updateTimetableResponseSchema = z.object({});
export type UpdateTimetableResponse = z.infer<
  typeof updateTimetableResponseSchema
>;
