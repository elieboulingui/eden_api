// app/controllers/coupons_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Coupon from '#models/coupon'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import { DateTime } from 'luxon'  // ✅ Ajout de l'import manquant

export default class CouponsController {

  // Méthode pour récupérer uniquement les coupons valides
  public async getValidCoupons({ request, response }: HttpContext) {
    const { page = 1, limit = 10, includeProduct = 'true' } = request.qs()
    const now = DateTime.now()

    let query = Coupon.query()
      .where('status', 'active')
      .andWhere((builder) => {
        builder
          .whereNull('valid_from')
          .orWhere('valid_from', '<=', now.toSQL())
      })
      .andWhere((builder) => {
        builder
          .whereNull('valid_until')
          .orWhere('valid_until', '>=', now.toSQL())
      })
      .andWhere((builder) => {
        builder
          .whereNull('usage_limit')
          .orWhereRaw('used_count < usage_limit')
      })
      .orderBy('created_at', 'desc')

    if (includeProduct === 'true') {
      query = query
        .leftJoin('products', 'coupons.product_id', 'products.id')
        .select(
          'coupons.*',
          'products.id as product_id',
          'products.name as product_name',
          'products.image_url as product_image_url',
          'products.price as product_price'
        )
    }

    const coupons = await query.paginate(Number(page), Number(limit))

    const data = coupons.all().map((coupon: any) => {
      const result = coupon.toJSON()

      if (coupon.product_id) {
        result.product = {
          id: coupon.product_id,
          name: coupon.product_name,
          image: coupon.product_image_url,
          price: coupon.product_price
        }
        delete result.product_id
        delete result.product_name
        delete result.product_image_url
        delete result.product_price
      }

      return result
    })

    return response.ok({
      success: true,
      data: data,
      meta: coupons.getMeta(),
    })
  }

  // Méthode pour récupérer tous les coupons (admin)
  public async getAllCoupons({ request, response }: HttpContext) {
    const { page = 1, limit = 10, includeProduct = 'true' } = request.qs()

    let query = Coupon.query().orderBy('created_at', 'desc')

    if (includeProduct === 'true') {
      query = query
        .leftJoin('products', 'coupons.product_id', 'products.id')
        .select(
          'coupons.*',
          'products.id as product_id',
          'products.name as product_name',
          'products.image_url as product_image_url',
          'products.price as product_price'
        )
    }

    const coupons = await query.paginate(Number(page), Number(limit))

    const data = coupons.all().map((coupon: any) => {
      const result = coupon.toJSON()

      // Ajouter le statut de validité
      result.is_valid = coupon.isValid()
      result.validity_reason = !coupon.isValid() ? this.getInvalidReason(coupon) : null

      if (coupon.product_id) {
        result.product = {
          id: coupon.product_id,
          name: coupon.product_name,
          image: coupon.product_image_url,
          price: coupon.product_price
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

  // Fonction utilitaire pour savoir pourquoi le coupon n'est pas valide
  private getInvalidReason(coupon: any): string {
    const now = DateTime.now()

    if (coupon.status !== 'active') {
      return `Le coupon est ${coupon.status}`
    }
    if (coupon.valid_from && DateTime.fromSQL(coupon.valid_from) > now) {
      return `Le coupon n'est pas encore actif (valide à partir du ${DateTime.fromSQL(coupon.valid_from).toFormat('dd/MM/yyyy')})`
    }
    if (coupon.valid_until && DateTime.fromSQL(coupon.valid_until) < now) {
      return `Le coupon a expiré le ${DateTime.fromSQL(coupon.valid_until).toFormat('dd/MM/yyyy')}`
    }
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return `Le coupon a atteint sa limite d'utilisation (${coupon.used_count}/${coupon.usage_limit})`
    }
    return 'Raison inconnue'
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
    const { code: rawCode, userId, items } = request.body()

    if (!rawCode) {
      return response.badRequest({ success: false, message: 'Code promo requis' })
    }

    const code = rawCode.trim()
    const coupon = await Coupon.query().where('code', code).first()

    if (!coupon) {
      return response.notFound({ success: false, message: 'Code promo introuvable' })
    }

    if (!coupon.isValid()) {
      return response.unprocessableEntity({ success: false, message: 'Coupon invalide ou expiré' })
    }

    // Calculer le montant total éligible
    let eligibleTotal = 0
    let eligibleItems = items || []

    if (coupon.product_id && items && items.length > 0) {
      eligibleItems = items.filter((item: any) => item.product_id === coupon.product_id)
      if (eligibleItems.length === 0) {
        return response.unprocessableEntity({ success: false, message: 'Ce coupon ne s\'applique à aucun produit de votre panier' })
      }
    }

    if (eligibleItems.length > 0) {
      for (const item of eligibleItems) {
        // Récupérer le prix du produit
        const product = await Coupon.query().select('price').from('products').where('id', item.product_id).first()
        if (product) {
          eligibleTotal += item.quantity * product.price
        }
      }
    }

    const discountAmount = coupon.calculateDiscount(eligibleTotal)
    const finalAmount = eligibleTotal - discountAmount

    return response.ok({
      success: true,
      data: {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          discount: coupon.discount,
          description: coupon.description,
        },
        discount_amount: discountAmount,
        final_amount: finalAmount,
      },
    })
  }

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