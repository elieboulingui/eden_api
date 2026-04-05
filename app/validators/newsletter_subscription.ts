import vine from '@vinejs/vine'

export const newsletterSubscriptionSchema = vine.object({
  email: vine.string()
    .trim()
    .email()
    .unique(
      async (db, value, field) => {
        const subscriber = await db
          .from('newsletter_subscribers')
          .where('email', value)
          .first()
        return !subscriber
      },
      {
        message: 'Cette adresse email est déjà inscrite à notre newsletter',
      }
    )
})

// Messages personnalisés supplémentaires
export const newsletterMessages = {
  'email.required': 'L\'adresse email est requise',
  'email.email': 'Veuillez fournir une adresse email valide',
  'email.unique': 'Cette adresse email est déjà inscrite à notre newsletter',
}