import type { HttpContext } from '@adonisjs/core/http'
import NewsletterSubscriber from '#models/newsletter_subscriber'

export default class NewsletterController {
  public async store({ request, response }: HttpContext) {
    try {
      const email = request.input('email')?.toString().trim()

      if (!email) {
        return response.badRequest({
          success: false,
          message: 'L’adresse email est requise',
        })
      }

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
