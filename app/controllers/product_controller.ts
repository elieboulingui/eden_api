// app/controllers/product_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import User from '#models/user'

export default class ProductsController {
  
  /**
   * ✅ Récupérer les frais de livraison pour un produit selon une zone
   */
  private async getDeliveryFeeForProduct(product: any, zone: string): Promise<number> {
    if (!product.user_id) return 0
    
    const merchant = await User.find(product.user_id)
    if (!merchant || !merchant.isMerchant) return 0
    
    return merchant.getDeliveryFee(zone)
  }

  /**
   * ✅ Ajouter les infos de livraison à un produit
   */
  private async enrichProductWithDelivery(product: any, zone?: string): Promise<any> {
    const merchant = await User.find(product.user_id)
    
    const deliveryInfo = {
      deliveryZones: merchant?.deliveryZonesList || [],
      deliveryFee: zone ? (merchant?.getDeliveryFee(zone) || 0) : 0,
      servesZone: zone ? (merchant?.servesZone(zone) || false) : false,
    }

    return {
      ...product,
      categoryName: product.categoryRelation?.name || null,
      merchant: merchant ? {
        id: merchant.id,
        full_name: merchant.full_name,
        shop_name: merchant.shop_name,
        commercial_name: merchant.commercial_name,
        shop_address: merchant.shop_address,
        whatsapp_phone: merchant.whatsapp_phone,
        country: merchant.country,
        neighborhood: merchant.neighborhood,
        is_verified: merchant.is_verified,
        logo_url: merchant.logo_url,
      } : null,
      delivery: deliveryInfo,
    }
  }

  /**
   * Récupère tous les produits en promotion (oldPrice > price)
   */
  async onSale({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const categoryId = request.input('category_id')
      const zone = request.input('zone') // ✅ Zone pour calculer les frais

      let query = Product.query()
        .whereNotNull('oldPrice')
        .where('oldPrice', '>', 0)
        .whereRaw('oldPrice > price')
        .where('isArchived', false)
        .where('status', 'active')
        .preload('user')
        .preload('categoryRelation')
        .orderByRaw('((oldPrice - price) / oldPrice) DESC')

      if (categoryId) {
        query = query.where('categoryId', categoryId)
      }

      const products = await query.paginate(page, limit)

      // ✅ Enrichir chaque produit avec les infos marchand et livraison
      const data = await Promise.all(
        products.all().map((product) => this.enrichProductWithDelivery(product.toJSON(), zone))
      )

      return response.json({
        success: true,
        data: data,
        meta: {
          page: products.currentPage,
          limit: products.perPage,
          total: products.total,
          lastPage: products.lastPage
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits en promotion',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupère les produits avec les plus grosses réductions
   */
  async biggestDiscounts({ request, response }: HttpContext) {
    try {
      const limit = request.input('limit', 10)
      const minDiscount = request.input('min_discount', 20)
      const zone = request.input('zone') // ✅ Zone pour calculer les frais

      const products = await Product.query()
        .whereNotNull('oldPrice')
        .where('oldPrice', '>', 0)
        .whereRaw('oldPrice > price')
        .whereRaw('((oldPrice - price) / oldPrice * 100) >= ?', [minDiscount])
        .where('isArchived', false)
        .where('status', 'active')
        .preload('user')
        .preload('categoryRelation')
        .orderByRaw('((oldPrice - price) / oldPrice) DESC')
        .limit(limit)

      // ✅ Enrichir chaque produit avec les infos marchand et livraison
      const data = await Promise.all(
        products.map((product) => this.enrichProductWithDelivery(product.toJSON(), zone))
      )

      return response.json({
        success: true,
        data: data,
        total: products.length,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des meilleures réductions',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupère les produits Black Friday (exemple)
   */
  async blackFriday({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const zone = request.input('zone') // ✅ Zone pour calculer les frais

      const products = await Product.query()
        .whereNotNull('oldPrice')
        .where('oldPrice', '>', 0)
        .whereRaw('oldPrice > price')
        .where('isArchived', false)
        .where('status', 'active')
        .where('isOnSale', true)
        .preload('user')
        .preload('categoryRelation')
        .orderByRaw('((oldPrice - price) / oldPrice) DESC')
        .paginate(page, limit)

      // ✅ Enrichir chaque produit avec les infos marchand et livraison
      const data = await Promise.all(
        products.all().map((product) => this.enrichProductWithDelivery(product.toJSON(), zone))
      )

      return response.json({
        success: true,
        data: data,
        meta: {
          page: products.currentPage,
          limit: products.perPage,
          total: products.total,
          lastPage: products.lastPage
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits Black Friday',
        error: errorMessage,
      })
    }
  }

  /**
   * ✅ Récupérer les frais de livraison pour un produit spécifique
   */
  async getDeliveryFee({ request, response }: HttpContext) {
    try {
      const productId = request.param('id')
      const zone = request.input('zone')

      if (!zone) {
        return response.status(400).json({
          success: false,
          message: 'Veuillez fournir une zone de livraison',
        })
      }

      const product = await Product.findOrFail(productId)
      const merchant = await User.find(product.user_id)

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé',
        })
      }

      const deliveryFee = merchant.getDeliveryFee(zone)
      const servesZone = merchant.servesZone(zone)

      return response.json({
        success: true,
        data: {
          product_id: product.id,
          product_name: product.name,
          zone: zone,
          delivery_fee: deliveryFee,
          serves_zone: servesZone,
          merchant_zones: merchant.deliveryZonesList,
        },
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des frais de livraison',
        error: errorMessage,
      })
    }
  }

  /**
   * ✅ Récupérer toutes les zones de livraison d'un marchand
   */
  async getMerchantDeliveryZones({ request, response }: HttpContext) {
    try {
      const userId = request.param('userId')
      const merchant = await User.findOrFail(userId)

      if (!merchant.isMerchant) {
        return response.status(400).json({
          success: false,
          message: 'Cet utilisateur n\'est pas un marchand',
        })
      }

      return response.json({
        success: true,
        data: {
          merchant_id: merchant.id,
          merchant_name: merchant.shop_name || merchant.full_name,
          delivery_zones: merchant.deliveryZonesList,
          total_zones: merchant.deliveryZonesList.length,
        },
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des zones de livraison',
        error: errorMessage,
      })
    }
  }
}
