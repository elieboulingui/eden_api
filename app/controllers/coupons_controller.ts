import type { HttpContext } from '@adonisjs/core/http'
import Coupon from '#models/coupon'

export default class CouponsController {
  /**
   * GET /api/coupons
   * Récupérer TOUS les coupons — sans auth, sans aucun filtre
   * 


   */

  // app/controllers/coupons_controller.ts

/**
 * POST /api/coupons/apply
 * Body: { code: string, order_amount: number, user_id?: string }
 */
async apply({ request, response }: HttpContext) {
  const { code, order_amount, user_id } = request.body()

  if (!code || !order_amount) {
    return response.badRequest({
      success: false,
      message: 'Le code promo et le montant de la commande sont requis',
    })
  }

  // Récupérer le coupon avec ses relations
  const coupon = await Coupon.query()
    .where('code', code.toUpperCase().trim())
    .preload('product')
    .preload('user')
    .first()

  if (!coupon) {
    return response.notFound({
      success: false,
      message: 'Code promo introuvable',
    })
  }

  // Vérifier validité
  if (!coupon.isValid()) {
    return response.unprocessableEntity({
      success: false,
      message: coupon.status === 'expired'
        ? 'Ce coupon a expiré'
        : coupon.status === 'disabled'
          ? 'Ce coupon est désactivé'
          : coupon.used_count >= coupon.usage_limit
            ? 'Ce coupon a atteint sa limite d\'utilisation'
            : 'Coupon invalide',
    })
  }

  // Vérifier montant minimum
  if (coupon.minimum_order_amount && order_amount < coupon.minimum_order_amount) {
    return response.unprocessableEntity({
      success: false,
      message: `Montant minimum requis : ${coupon.minimum_order_amount.toLocaleString()} FCFA`,
      data: {
        minimum_order_amount: coupon.minimum_order_amount,
        current_amount: order_amount,
        missing_amount: coupon.minimum_order_amount - order_amount,
      },
    })
  }

  // Calculer la réduction
  const discount_amount = coupon.calculateDiscount(order_amount)
  const final_amount = order_amount - discount_amount

  // ✅ Incrémenter l'usage (usage du coupon)
  await coupon.incrementUsage()

  // Si usage_limit atteinte après incrément → passer en expired
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    coupon.status = 'expired'
    await coupon.save()
  }

  return response.ok({
    success: true,
    message: 'Coupon appliqué avec succès',
    data: {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        discount: coupon.discount,
        description: coupon.description,
        product: coupon.product ?? null,
        usage_limit: coupon.usage_limit,
        used_count: coupon.used_count,         // ← après incrément
        remaining_uses: coupon.usage_limit
          ? coupon.usage_limit - coupon.used_count
          : null,
      },
      pricing: {
        original_amount: order_amount,          // montant avant réduction
        discount_amount,                        // montant de la réduction
        final_amount,                           // montant final à payer
        discount_label:
          coupon.type === 'percentage'
            ? `-${coupon.discount}%`
            : `-${coupon.discount.toLocaleString()} FCFA`,
      },
    },
  })
}
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
