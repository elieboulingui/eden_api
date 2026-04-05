import type { HttpContext } from '@adonisjs/core/http'
import NewsletterSubscriber from '#models/newsletter_subscriber'
import { newsletterSubscriptionSchema } from '#validators/newsletter_subscription'

export default class NewsletterController {
  public async store({ request, response }: HttpContext) {
    try {
      const payload = await newsletterSubscriptionSchema.parseAsync(request.all())
      const { email } = payload as { email: string }

      const existing = await NewsletterSubscriber.findBy('email', email)
      if (existing) {
        return response.badRequest({
          success: false,
          message: 'Cette adresse email est déjà inscrite à notre newsletter',
        })
      }

      const subscriber = await NewsletterSubscriber.create({ email })
      return response.created({
        success: true,
        data: { id: subscriber.id, email: subscriber.email },
        message: 'Inscription à la newsletter confirmée',
      })
    } catch (error: any) {
      return response.badRequest({
        success: false,
        message: error.errors?.[0]?.message || error.message || 'Impossible de s’inscrire',
      })
    }
  }
}
