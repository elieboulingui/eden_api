import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import Promotion from '#models/promotion'

export default class HomeController {
  async index({ view }: HttpContext) {
    const now = new Date()

    const promotions = await Promotion.query()
      .where('status', 'active')
      .where((query) => {
        query.where('start_date', '<=', now).orWhereNull('start_date')
      })
      .where((query) => {
        query.where('end_date', '>=', now).orWhereNull('end_date')
      })
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'desc')

    // ✅ CORRECTION : Ajouter .preload('user') pour charger les infos du vendeur
    const products = await Product.query()
      .where('is_archived', false)
      .preload('user')  // ← IMPORTANT : charge la relation user
      .orderBy('created_at', 'desc')

    return view.render('pages/home', {
      promotions,
      products,
    })
  }
}
