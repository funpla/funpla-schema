import { z } from "zod/v3";

// ══════════════════════════════════════════════════════════════════════════
// 運用設定(Workers KV)用スキーマ
//
// 管理画面(funpla-admin)が書き、frontend の middleware と backend のガードが読む。
// メンテナンスとバナーは別キーに分ける。KV は結果整合のため、1 キーにまとめると
// 「state だけ伝播して message は旧値」という中途半端な状態が外から見える。
// また更新頻度が違う（バナーは頻繁・メンテは稀）ため、同居させると read-modify-write で
// 片方の更新がもう片方を巻き戻す事故が起きる。
//
// 読み取り側は parse に失敗したら通常運転に倒す（メンテは off、バナーは非表示）。
// KV 障害でサービス全体が止まるのを避けるため、「読めない＝止める」にはしない。
// ══════════════════════════════════════════════════════════════════════════

/** メンテナンス設定の KV キー */
export const MAINTENANCE_KV_KEY = "maintenance";

/** バナー設定の KV キー */
export const BANNER_KV_KEY = "banner";

/**
 * メンテナンスの対象範囲。
 * `all` は全機能。機能名は backend のルートグループに対応する。
 */
export const maintenanceScopeSchema = z.enum([
  "all",
  "party",
  "quiz",
  "bingo",
  "date-poll",
  "attendance",
  "timetable",
  "roster",
  "expense",
]);
export type MaintenanceScope = z.infer<typeof maintenanceScopeSchema>;

/**
 * メンテナンスの状態。
 * - `off`: 通常運転
 * - `on`: 遮断（bypass を除き 503 を返す）
 *
 * 遮断するかどうかはこの 1 フィールドだけで決まる。時刻は判定に使わないため、
 * 予定時刻を過ぎても自動では解除されない（解除は必ず手動）。
 */
export const maintenanceStateSchema = z.enum(["off", "on"]);
export type MaintenanceState = z.infer<typeof maintenanceStateSchema>;

/**
 * メンテナンス設定。KV の `maintenance` キーに JSON で格納する。
 *
 * `state` による discriminated union。`off` は状態のみを持つ。
 *
 * `on` 側は `{ "state": "on" }` だけでも成立する（緊急時に文言を考えずに止められる）。
 * メンテナンス画面の固定文言は表示側が持ち、ここの値は補足として扱う。
 * - `scope`: 止める範囲。省略時は `["all"]` で全機能
 * - `message`: 追加で表示する文言。null なら固定文言のみ
 * - `plannedEndAt`: 終了予定時刻(ISO8601)。**表示専用**で判定には使わない。null なら出さない
 *
 * 「誰がいつ変えたか」は持たない。監査は履歴テーブル側の担当。
 */
export const maintenanceSettingsSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("off"),
  }),
  z.object({
    state: z.literal("on"),
    scope: z.array(maintenanceScopeSchema).min(1).default(["all"]),
    message: z.string().min(1).nullable().default(null),
    plannedEndAt: z.string().datetime().nullable().default(null),
  }),
]);
export type MaintenanceSettings = z.infer<typeof maintenanceSettingsSchema>;

/**
 * バナーの強調度。表示の色分けに使う。
 */
export const bannerLevelSchema = z.enum(["info", "warning"]);
export type BannerLevel = z.infer<typeof bannerLevelSchema>;

/**
 * バナーの表示状態。
 * - `hidden`: 出さない
 * - `visible`: 全ページ上部に表示する
 */
export const bannerStateSchema = z.enum(["hidden", "visible"]);
export type BannerState = z.infer<typeof bannerStateSchema>;

/**
 * お知らせバナー設定。KV の `banner` キーに JSON で格納する。
 * メンテナンスの状態とは独立していて、通常運転中にも出せる
 * （メンテ予告、障害告知、新機能のお知らせなど）。
 *
 * `state` による discriminated union。`visible` のときだけ文言とリンクを持つ。
 * メンテナンスと違って固定文言が無く、文言の無いバナーは意味を成さないため
 * `message` だけは必須にする。
 * - `message`: バナーに出す文言
 * - `level`: 強調度。省略時は `info`
 * - `linkUrl`: 詳細ページへのリンク。アプリ内の絶対パス（例 `/news/xxxx`）。不要なら null
 */
export const bannerSettingsSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("hidden"),
  }),
  z.object({
    state: z.literal("visible"),
    message: z.string().min(1),
    level: bannerLevelSchema.default("info"),
    linkUrl: z.string().nullable().default(null),
  }),
]);
export type BannerSettings = z.infer<typeof bannerSettingsSchema>;
