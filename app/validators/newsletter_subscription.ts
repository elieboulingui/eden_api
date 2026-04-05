import vine from '@vinejs/vine'

export const newsletterSubscriptionSchema = vine.object({
  email: vine
    .string()
    .trim()
    .lowercase()
    .email()
    .min(5),
})
