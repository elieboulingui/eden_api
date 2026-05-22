// app/controllers/product_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import User from '#models/user'

export default class ProductsController {
  
  /**
   * ✅ Enrichit un produit avec toutes ses informations (images, livraison, etc.)
   */
  private async enrichProductWithDelivery(productData: any, zone?: string): Promise<any> {
    let merchant = null
    let deliveryInfo = {
      deliveryZones: [] as { zone: string; fee: number }[],
      deliveryFee: 0,
      servesZone: false,
    }

    // Récupérer le produit complet avec ses relations
    const product = await Product.query()
      .where('id', productData.id)
      .preload('user')
      .preload('categoryRelation')
      .first()

    if (!product) return productData

    if (product.user_id) {
      merchant = await User.find(product.user_id)
      
      if (merchant) {
        const zones = merchant.delivery_zones || {}
        
        deliveryInfo = {
          deliveryZones: Object.entries(zones).map(([z, fee]) => ({
            zone: z.charAt(0).toUpperCase() + z.slice(1),
            fee: Number(fee),
          })),
          deliveryFee: zone ? merchant.getDeliveryFee(zone) : 0,
          servesZone: zone ? merchant.servesZone(zone) : false,
        }
      }
    }

    // ✅ Récupérer toutes les informations du produit
    const json = product.toJSON()
    
    return {
      ...json,
      // ✅ Catégorie
      categoryName: product.categoryRelation?.name || null,
      
      // ✅ TOUTES LES IMAGES
      images: product.allImages,
      imagesCount: product.imagesCount,
      image_url: product.image_url,
      image_url_2: product.imageUrl2,
      image_url_3: product.imageUrl3,
      image_url_4: product.imageUrl4,
      image_url_5: product.imageUrl5,
      
      // ✅ INFORMATIONS DE BOOST
      isBoostActive: product.isBoostActive,
      boostMultiplier: product.boostMultiplier,
      boostLevel: product.boostLevel,
      boostBadge: product.boostBadge,
      boostBadgeConfig: product.boostBadgeConfig,
      boostCardStyle: product.boostCardStyle,
      boostRemainingDays: product.boostRemainingDays,
      boostRemainingHours: product.boostRemainingHours,
      boostProgressPercentage: product.boostProgressPercentage,
      boostConversionRate: product.boostConversionRate,
      boostScore: product.boostScore,
      boostViews: product.boostViews,
      boostClicks: product.boostClicks,
      boostSales: product.boostSales,
      
      // ✅ INFORMATIONS SUR LES RÉDUCTIONS
      discountPercentage: product.discountPercentage,
      savings: product.savings,
      hasDiscount: product.hasDiscount,
      isInStock: product.isInStock,
      
      // ✅ MARCHAND
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
        delivery_zones: Object.entries(merchant.delivery_zones || {}).map(([z, fee]) => ({
          zone: z.charAt(0).toUpperCase() + z.slice(1),
          fee: Number(fee),
        })),
      } : null,
      
      // ✅ LIVRAISON
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
      const zone = request.input('zone')

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

      const data = await Promise.all(
        products.all().map((product) => this.enrichProductWithDelivery(product, zone))
      )

      return response.json({
        success: true,
        data,
        meta: {
          page: products.currentPage,
          limit: products.perPage,
          total: products.total,
          lastPage: products.lastPage,
        },
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
      const zone = request.input('zone')

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

      const data = await Promise.all(
        products.map((product) => this.enrichProductWithDelivery(product, zone))
      )

      return response.json({
        success: true,
        data,
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
   * Récupère les produits Black Friday
   */
  async blackFriday({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const zone = request.input('zone')

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

      const data = await Promise.all(
        products.all().map((product) => this.enrichProductWithDelivery(product, zone))
      )

      return response.json({
        success: true,
        data,
        meta: {
          page: products.currentPage,
          limit: products.perPage,
          total: products.total,
          lastPage: products.lastPage,
        },
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
  async getDeliveryFee({ params, request, response }: HttpContext) {
    try {
      const productId = params.id
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

      const zones = Object.entries(merchant.delivery_zones || {}).map(([z, fee]) => ({
        zone: z.charAt(0).toUpperCase() + z.slice(1),
        fee: Number(fee),
      }))

      return response.json({
        success: true,
        data: {
          product_id: product.id,
          product_name: product.name,
          // ✅ TOUTES LES IMAGES DU PRODUIT
          product_images: product.allImages,
          product_images_count: product.imagesCount,
          product_image_url: product.image_url,
          product_image_url_2: product.imageUrl2,
          product_image_url_3: product.imageUrl3,
          product_image_url_4: product.imageUrl4,
          product_image_url_5: product.imageUrl5,
          zone,
          delivery_fee: deliveryFee,
          serves_zone: servesZone,
          merchant_zones: zones,
          // ✅ INFORMATIONS DE BOOST
          is_boosted: product.isBoosted,
          boost_multiplier: product.boostMultiplier,
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
  async getMerchantDeliveryZones({ params, response }: HttpContext) {
    try {
      const userId = params.userId
      const merchant = await User.findOrFail(userId)

      if (!merchant.isMerchant) {
        return response.status(400).json({
          success: false,
          message: "Cet utilisateur n'est pas un marchand",
        })
      }

      const zones = Object.entries(merchant.delivery_zones || {}).map(([z, fee]) => ({
        zone: z.charAt(0).toUpperCase() + z.slice(1),
        fee: Number(fee),
      }))

      return response.json({
        success: true,
        data: {
          merchant_id: merchant.id,
          merchant_name: merchant.shop_name || merchant.full_name,
          delivery_zones: zones,
          total_zones: zones.length,
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
