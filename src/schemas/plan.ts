import { z } from "zod/v3";

/**
 * プランタイプ
 * - `free`: Free プラン
 * - `standard`: Standard プラン
 * - `wedding`: Wedding プラン
 */
export const planTypeSchema = z.enum(["free", "standard", "wedding"]);
/**
 * プランタイプ
 * - `free`: Free プラン
 * - `standard`: Standard プラン
 * - `wedding`: Wedding プラン
 */
export type PlanType = z.infer<typeof planTypeSchema>;
