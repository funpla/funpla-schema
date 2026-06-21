import { z } from "zod/v3";

export const eventTypeSchema = z.enum(["懇親会", "ウェディング", "その他"]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const partySchema = z.object({
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
export type Party = z.infer<typeof partySchema>;

/** POST /party のリクエストボディ */
export const createPartyRequestSchema = partySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreatePartyRequest = z.infer<typeof createPartyRequestSchema>;

/** POST /party のレスポンスボディ */
export const createPartyResponseSchema = partySchema.pick({ id: true });
export type CreatePartyResponse = z.infer<typeof createPartyResponseSchema>;

/** GET /party のリクエストクエリ */
export const listPartiesRequestSchema = z.object({});
export type ListPartiesRequest = z.infer<typeof listPartiesRequestSchema>;

/** GET /party のレスポンスボディ */
export const listPartiesResponseSchema = z.object({
  parties: z.array(partySchema),
});
export type ListPartiesResponse = z.infer<typeof listPartiesResponseSchema>;
