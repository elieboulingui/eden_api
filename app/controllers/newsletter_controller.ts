import type { HttpContext } from '@adonisjs/core/http'
import NewsletterSubscriber from '#models/newsletter_subscriber'
import { newsletterSubscriptionSchema } from '#validators/newsletter_subscription'

export default class NewsletterController {
  public async store({ request, response }: HttpContext) {
    try {
      const payload = await request.validate({ schema: newsletterSubscriptionSchema })
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
