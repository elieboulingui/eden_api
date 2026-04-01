import type { HttpContext } from '@adonisjs/core/http'
import Coupon from '#models/coupon'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'

export default class CouponsController {

  public async index({ request, response }: HttpContext) {
    const { page = 1, limit = 10, includeProduct = 'true' } = request.qs()

    let query = Coupon.query()
      .select('coupons.*')
      .orderBy('coupons.created_at', 'desc')

    if (includeProduct === 'true') {
      query = query
        .leftJoin('products', 'coupons.product_id', 'products.id')
        .select(
          'products.id as product_id',
          'products.name as product_name',
          'products.image_url as product_image_url',
          'products.price as product_price'
        )
    }

    const coupons = await query.paginate(Number(page), Number(limit))

    const data = coupons.all().map((coupon) => {
      const json = coupon.toJSON()
      const result: any = {}

      Object.keys(json).forEach(key => {
        if (!key.startsWith('product_')) {
          result[key] = json[key]
        }
      })

      if (json.product_id) {
        result.product = {
          id: json.product_id,
          name: json.product_name,
          image: json.product_image_url,
          price: json.product_price
        }
      }

      return result
    })

    return response.ok({
      success: true,
      data: data,
      meta: coupons.getMeta(),
    })
  }

  public async show({ params, response }: HttpContext) {
    const coupon = await Coupon.query()
      .where('id', params.id)
      .preload('product')
      .firstOrFail()

    return response.ok({
      success: true,
      data: coupon,
    })
  }

  public async verify({ request, response }: HttpContext) {
    // Même code que tu avais pour la vérification
    const { code: rawCode, userId } = request.body()

    if (!rawCode || !userId) {
      return response.badRequest({ success: false, message: 'Code promo et userId requis' })
    }

    const code = rawCode.trim()
    const coupon = await Coupon.query().where('code', code).first()

    if (!coupon) {
      return response.notFound({ success: false, message: 'Code promo introuvable' })
    }

    return response.ok({ success: true, coupon })
  }

  // ← Nouvelle méthode apply
  public async apply({ request, response }: HttpContext) {
    const { code: rawCode, userId } = request.body()

    if (!rawCode || !userId) {
      return response.badRequest({ success: false, message: 'Code promo et userId requis' })
    }

    const code = rawCode.trim()
    const coupon = await Coupon.query().where('code', code).first()

    if (!coupon) {
      return response.notFound({ success: false, message: 'Code promo introuvable' })
    }

    if (!coupon.isValid()) {
      return response.unprocessableEntity({ success: false, message: 'Coupon invalide ou expiré' })
    }

    if (!coupon.userIds) coupon.userIds = []

    if (coupon.userIds.includes(userId)) {
      return response.unprocessableEntity({ success: false, message: 'Déjà utilisé par cet utilisateur' })
    }

    const cart = await Cart.query().where('user_id', userId).first()
    if (!cart) {
      return response.unprocessableEntity({ success: false, message: "L'utilisateur n'a pas de panier" })
    }

    const cartItems = await CartItem.query()
      .where('cart_id', cart.id)
      .preload('product')

    if (!cartItems || cartItems.length === 0) {
      return response.unprocessableEntity({ success: false, message: 'Le panier est vide' })
    }

    let validItems = cartItems
    if (coupon.product_id) {
      validItems = cartItems.filter(item => item.product_id === coupon.product_id)
      if (validItems.length === 0) {
        return response.unprocessableEntity({ success: false, message: 'Aucun produit éligible pour ce coupon' })
      }
    }

    let totalAmount = 0
    for (const item of validItems) {
      totalAmount += item.quantity * item.product.price
    }

    const discountAmount = coupon.calculateDiscount(totalAmount)
    const discountedTotal = totalAmount - discountAmount

    coupon.userIds.push(userId)
    coupon.used_count += 1
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      coupon.status = 'expired'
    }

    await coupon.save()

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
        },
        valid_items: validItems.map(i => ({
          id: i.id,
          product_id: i.product_id,
          quantity: i.quantity,
          price: i.product.price,
          total: i.quantity * i.product.price,
        })),
        total_amount: totalAmount,
        discount_amount: discountAmount,
        discounted_total: discountedTotal,
        remaining_uses: coupon.usage_limit ? coupon.usage_limit - coupon.used_count : null,
        user_ids: coupon.userIds,
      },
    })
  }
}