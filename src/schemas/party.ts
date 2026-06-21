import { z } from "zod/v3";

/**
 * イベント種別
 * - `networking`: 懇親会
 * - `wedding`: ウェディング
 * - `other`: その他
 */
export const eventTypeSchema = z.enum(["networking", "wedding", "other"]);
export type EventType = z.infer<typeof eventTypeSchema>;

/**
 * 会費種別
 * - `per_person`: 一人当たり（別途予算の入力が必要）
 * - `total`: 総額
 */
export const feeTypeSchema = z.enum(["per_person", "total"]);
export type FeeType = z.infer<typeof feeTypeSchema>;

const partyBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  eventType: eventTypeSchema,
  startDate: z.string().date(),
  startTime: z.string().time({ precision: 0 }),
  endDate: z.string().date(),
  endTime: z.string().time({ precision: 0 }),
  guestCount: z.number().int().positive(),
  feeType: feeTypeSchema.nullable(),
  fee: z.number().int().nonnegative().nullable(),
  /** 一人当たりの場合の総予算。feeType が per_person のとき必須 */
  budget: z.number().int().nonnegative().nullable(),
  memo: z.string().max(200).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const validateDateTimeRange = (data: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}) =>
  new Date(`${data.startDate}T${data.startTime}`) <=
  new Date(`${data.endDate}T${data.endTime}`);

const dateTimeRangeError = {
  message: "終了日時は開始日時より後にしてください",
};

const validateBudget = (
  data: { feeType: string | null; budget: number | null },
  ctx: z.RefinementCtx,
) => {
  if (data.feeType === "per_person" && data.budget === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "一人当たりの場合は予算を入力してください",
      path: ["budget"],
    });
  }
};

export const partySchema = partyBaseSchema
  .refine(validateDateTimeRange, dateTimeRangeError)
  .superRefine(validateBudget);
export type Party = z.infer<typeof partySchema>;

/** POST /party のリクエストボディ */
export const createPartyRequestSchema = partyBaseSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine(validateDateTimeRange, dateTimeRangeError)
  .superRefine(validateBudget);
export type CreatePartyRequest = z.infer<typeof createPartyRequestSchema>;

/** POST /party のレスポンスボディ */
export const createPartyResponseSchema = partyBaseSchema.pick({ id: true });
export type CreatePartyResponse = z.infer<typeof createPartyResponseSchema>;

/** GET /party/:id のパスパラメータ */
export const getPartyParamsSchema = partyBaseSchema.pick({ id: true });
export type GetPartyParams = z.infer<typeof getPartyParamsSchema>;

/** GET /party/:id のレスポンスボディ */
export const getPartyResponseSchema = partySchema;
export type GetPartyResponse = z.infer<typeof getPartyResponseSchema>;

/** GET /party のリクエストクエリ */
export const listPartiesRequestSchema = z.object({});
export type ListPartiesRequest = z.infer<typeof listPartiesRequestSchema>;

/** GET /party のレスポンスボディ */
export const listPartiesResponseSchema = z.object({
  parties: z.array(partySchema),
});
export type ListPartiesResponse = z.infer<typeof listPartiesResponseSchema>;
