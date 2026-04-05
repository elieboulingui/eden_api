import type { HttpContext } from '@adonisjs/core/http'
import NewsletterSubscriber from '#models/newsletter_subscriber'
import { newsletterSubscriptionSchema } from '#validators/newsletter_subscription'

export default class NewsletterController {
  public async store({ request, response }: HttpContext) {
    try {
      const payload = await newsletterSubscriptionSchema.parse(request.all())
      const existing = await NewsletterSubscriber.findBy('email', payload.email)
      if (existing) {
        return response.badRequest({
          success: false,
          message: 'Cette adresse email est déjà inscrite à notre newsletter',
        })
      }
      const subscriber = await NewsletterSubscriber.create(payload)
      return response.created({
        success: true,
        data: { id: subscriber.id, email: subscriber.email },
        message: 'Inscription à la newsletter confirmée',
      })
    } catch (error: any) {
      return response.badRequest({
        success: false,
        message: error.messages?.errors?.[0]?.message || error.message || 'Impossible de s’inscrire',
      })
    }
  }
}
