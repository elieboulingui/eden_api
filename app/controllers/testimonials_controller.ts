import type { HttpContext } from '@adonisjs/core/http'
import Testimonial from '#models/testimonial'

export default class TestimonialsController {
  // 🔹 Lister
  async index({ }: HttpContext) {
    return await Testimonial.query().preload('user')
  }

  // 🔹 Créer (sans auth)
  async store({ request }: HttpContext) {
    const data = request.only(['rating', 'text', 'user_id'])

    const testimonial = await Testimonial.create({
      rating: data.rating,
      text: data.text,
      userId: data.user_id, // 👈 envoyé depuis frontend
    })

    return testimonial
  }

  // 🔹 Voir un témoignage
  async show({ params }: HttpContext) {
    return await Testimonial
      .query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()
  }

  // 🔹 Modifier
  async update({ params, request }: HttpContext) {
    const testimonial = await Testimonial.findOrFail(params.id)

    const data = request.only(['rating', 'text'])

    testimonial.merge(data)
    await testimonial.save()

    return testimonial
  }

  // 🔹 Supprimer
  async destroy({ params }: HttpContext) {
    const testimonial = await Testimonial.findOrFail(params.id)

    await testimonial.delete()

    return { message: 'Témoignage supprimé' }
  }
}
