import type { HttpContext } from '@adonisjs/core/http'
import Coupon from '#models/coupon'

export default class CouponsController {
  /**
   * GET /api/coupons
   * Récupérer TOUS les coupons — sans auth, sans aucun filtre
   */
  async index({ request, response }: HttpContext) {
    const { page = 1, limit = 10 } = request.qs()

    const coupons = await Coupon.query()
      .preload('product')
      .orderBy('created_at', 'desc')
      .paginate(Number(page), Number(limit))

    // On transforme chaque coupon en objet JSON pur
    const data = coupons.all().map((coupon) => {
      const json = coupon.toJSON()

      // SI le produit est null, on supprime carrément la clé "product"
      if (!json.product) {
        delete json.product
      }
      console.log(json)
      return json
    })

    return response.ok({
      success: true,
      data: data, // Ici on envoie les données nettoyées
      meta: coupons.getMeta(),
    })
  }
  /**
   * GET /api/coupons/:id
   */
  async show({ params, response }: HttpContext) {
    const coupon = await Coupon.query()
      .where('id', params.id)
      .preload('product')
      .firstOrFail()

    return response.ok({
      success: true,
      data: coupon,
    })
  }

  /**
   * GET /api/coupons/verify/:code?order_amount=5000
   */
  async verify({ params, request, response }: HttpContext) {
    const { order_amount } = request.qs()

    const coupon = await Coupon.query()
      .where('code', params.code.toUpperCase())
      .preload('product')
      .first()

    if (!coupon) {
      return response.notFound({
        success: false,
        message: 'Code promo introuvable',
      })
    }

    const isValid = coupon.isValid()

    let meetsMinimum = true
    if (isValid && coupon.minimum_order_amount && order_amount) {
      meetsMinimum = Number(order_amount) >= coupon.minimum_order_amount
    }

    const discountAmount =
      isValid && order_amount ? coupon.calculateDiscount(Number(order_amount)) : null

    return response.ok({
      success: true,
      data: {
        coupon,
        is_valid: isValid && meetsMinimum,
        discount_amount: discountAmount,
        reason: !isValid
          ? 'Coupon invalide ou expiré'
          : !meetsMinimum
            ? `Montant minimum requis : ${coupon.minimum_order_amount} FCFA`
            : null,
      },
    })
  }
}
