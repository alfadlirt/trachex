import { z } from 'zod';

export const createProjectSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const createTicketSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const adjustmentSchema = z.object({
  source: z.enum(['fsd', 'brd', 'chat', 'meeting', 'clarification', 'uat', 'manual', 'context']),
  attribution: z.string().optional(),
  note: z.string().min(1),
});

export const checkSchema = z.object({
  confirm: z.literal(true),
});
