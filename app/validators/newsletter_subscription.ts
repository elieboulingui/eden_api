import vine from '@vinejs/vine'

export const newsletterSubscriptionSchema = vine.object({
  email: vine
    .string()
    .trim()
    .transform((value) =>
      typeof value === 'string' ? value.toLowerCase() : value
    )
    .email()
    .min(5),
})
