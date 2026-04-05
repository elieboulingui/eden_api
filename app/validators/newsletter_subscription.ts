import { schema, rules } from '@ioc:Adonis/Core/Validator'

export const newsletterSubscriptionSchema = schema.create({
  email: schema.string({ trim: true }, [
    rules.email(),
    rules.unique({ table: 'newsletter_subscribers', column: 'email' }),
  ]),
})

export const newsletterSubscriptionMessages = {
  'email.required': 'L’adresse email est requise',
  'email.email': 'Veuillez fournir une adresse email valide',
  'email.unique': 'Cette adresse email est déjà inscrite à notre newsletter',
}
