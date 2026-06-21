import { z } from "zod/v3";

export const eventTypeSchema = z.enum(["懇親会", "ウェディング", "その他"]);
export type EventType = z.infer<typeof eventTypeSchema>;

const partyBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  eventType: eventTypeSchema,
  startDate: z.string().date(),
  startTime: z.string().time({ precision: 0 }),
  endDate: z.string().date(),
  endTime: z.string().time({ precision: 0 }),
  guestCount: z.number().int().positive(),
  fee: z.number().int().nonnegative(),
  memo: z.string().nullable(),
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

export const partySchema = partyBaseSchema.refine(
  validateDateTimeRange,
  dateTimeRangeError,
);
export type Party = z.infer<typeof partySchema>;

/** POST /party のリクエストボディ */
export const createPartyRequestSchema = partyBaseSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .refine(validateDateTimeRange, dateTimeRangeError);
export type CreatePartyRequest = z.infer<typeof createPartyRequestSchema>;

/** POST /party のレスポンスボディ */
export const createPartyResponseSchema = partyBaseSchema.pick({ id: true });
export type CreatePartyResponse = z.infer<typeof createPartyResponseSchema>;

/** GET /party のリクエストクエリ */
export const listPartiesRequestSchema = z.object({});
export type ListPartiesRequest = z.infer<typeof listPartiesRequestSchema>;

/** GET /party のレスポンスボディ */
export const listPartiesResponseSchema = z.object({
  parties: z.array(partySchema),
});
export type ListPartiesResponse = z.infer<typeof listPartiesResponseSchema>;
