// app/controllers/promotions_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Promotion from '#models/promotion'
import Product from '#models/product'

export default class PromotionsController {
  /**
   * Récupérer toutes les promotions avec les produits associés
   */
  async index({ request, response }: HttpContext) {
    try {
      const status = request.input('status', 'active')
      const type = request.input('type')
      const category = request.input('category')
      const limit = request.input('limit', 10)
      const now = new Date()

      let query = Promotion.query()

      // Filtre par statut
      if (status !== 'all') {
        query = query.where('status', status)
      }

      // Filtre par type
      if (type) {
        query = query.where('type', type)
      }

      // Filtre par catégorie
      if (category) {
        query = query.where('category', category)
      }

      // Filtre par date (actives)
      if (status === 'active') {
        query = query
          .where('start_date', '<=', now)
          .orWhereNull('start_date')
          .where('end_date', '>=', now)
          .orWhereNull('end_date')
      }

      const promotions = await query
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'desc')
        .limit(limit)

      // Récupérer les produits associés à chaque promotion
      const promotionsWithProducts = await Promise.all(
        promotions.map(async (promotion) => {
          let products: any[] = []
          let imageUrl = promotion.image_url

          // Si la promotion a des product_ids, récupérer les produits
          if (promotion.product_ids) {
            let productIds: string[] = []
            
            if (typeof promotion.product_ids === 'string') {
              try {
                productIds = JSON.parse(promotion.product_ids)
              } catch {
                productIds = promotion.product_ids.split(',').map(id => id.trim())
              }
            } else if (Array.isArray(promotion.product_ids)) {
              productIds = promotion.product_ids
            }

            if (productIds.length > 0) {
              products = await Product.query()
                .whereIn('id', productIds)
                .where('is_archived', false)
                .where('status', 'active')
                .select('id', 'name', 'price', 'old_price', 'image_url', 'description', 'category')
              
              // Si pas d'image sur la promotion, prendre l'image du premier produit
              if (!imageUrl && products.length > 0 && products[0].image_url) {
                imageUrl = products[0].image_url
              }
            }
          }

          return {
            id: promotion.id,
            title: promotion.title,
            description: promotion.description,
            image_url: imageUrl,
            banner_image: promotion.banner_image,
            type: promotion.type,
            discount_percentage: promotion.discount_percentage,
            discount_amount: promotion.discount_amount,
            category: promotion.category,
            product_ids: promotion.product_ids,
            link: promotion.link,
            button_text: promotion.button_text,
            min_order_amount: promotion.min_order_amount,
            start_date: promotion.start_date,
            end_date: promotion.end_date,
            status: promotion.status,
            priority: promotion.priority,
            created_at: promotion.created_at,
            updated_at: promotion.updated_at,
            products: products.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              old_price: p.old_price,
              image_url: p.image_url,
              description: p.description,
              category: p.category
            }))
          }
        })
      )

      return response.json({
        success: true,
        data: promotionsWithProducts,
        meta: {
          total: promotions.length,
          status: status,
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Récupérer une promotion spécifique avec ses produits
   */
  async show({ params, response }: HttpContext) {
    try {
      const promotion = await Promotion.find(params.id)

      if (!promotion) {
        return response.status(404).json({
          success: false,
          message: 'Promotion non trouvée',
        })
      }

      let products: any[] = []
      let imageUrl = promotion.image_url

      // Récupérer les produits associés
      if (promotion.product_ids) {
        let productIds: string[] = []
        
        if (typeof promotion.product_ids === 'string') {
          try {
            productIds = JSON.parse(promotion.product_ids)
          } catch {
            productIds = promotion.product_ids.split(',').map(id => id.trim())
          }
        } else if (Array.isArray(promotion.product_ids)) {
          productIds = promotion.product_ids
        }

        if (productIds.length > 0) {
          products = await Product.query()
            .whereIn('id', productIds)
            .where('is_archived', false)
            .where('status', 'active')
            .select('id', 'name', 'price', 'old_price', 'image_url', 'description', 'category')
          
          if (!imageUrl && products.length > 0 && products[0].image_url) {
            imageUrl = products[0].image_url
          }
        }
      }

      return response.json({
        success: true,
        data: {
          id: promotion.id,
          title: promotion.title,
          description: promotion.description,
          image_url: imageUrl,
          banner_image: promotion.banner_image,
          type: promotion.type,
          discount_percentage: promotion.discount_percentage,
          discount_amount: promotion.discount_amount,
          category: promotion.category,
          product_ids: promotion.product_ids,
          link: promotion.link,
          button_text: promotion.button_text,
          min_order_amount: promotion.min_order_amount,
          start_date: promotion.start_date,
          end_date: promotion.end_date,
          status: promotion.status,
          priority: promotion.priority,
          created_at: promotion.created_at,
          updated_at: promotion.updated_at,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            old_price: p.old_price,
            image_url: p.image_url,
            description: p.description,
            category: p.category
          }))
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Récupérer les bannières (pour le header)
   */
  async banners({ response }: HttpContext) {
    try {
      const now = new Date()
      const banners = await Promotion.query()
        .where('type', 'banner')
        .where('status', 'active')
        .where('start_date', '<=', now)
        .orWhereNull('start_date')
        .where('end_date', '>=', now)
        .orWhereNull('end_date')
        .orderBy('priority', 'desc')

      // Récupérer les images des produits pour chaque bannière
      const bannersWithImages = await Promise.all(
        banners.map(async (banner) => {
          let imageUrl = banner.image_url
          
          if (banner.product_ids && !imageUrl) {
            let productIds: string[] = []
            if (typeof banner.product_ids === 'string') {
              try {
                productIds = JSON.parse(banner.product_ids)
              } catch {
                productIds = banner.product_ids.split(',').map(id => id.trim())
              }
            } else if (Array.isArray(banner.product_ids)) {
              productIds = banner.product_ids
            }

            if (productIds.length > 0) {
              const firstProduct = await Product.query()
                .whereIn('id', productIds)
                .where('is_archived', false)
                .first()
              
              if (firstProduct?.image_url) {
                imageUrl = firstProduct.image_url
              }
            }
          }

          return {
            ...banner.toJSON(),
            image_url: imageUrl
          }
        })
      )

      return response.json({
        success: true,
        data: bannersWithImages,
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Récupérer les offres flash
   */
  async flashSales({ response }: HttpContext) {
    try {
      const now = new Date()
      const flashSales = await Promotion.query()
        .where('type', 'flash_sale')
        .where('status', 'active')
        .where('end_date', '>=', now)
        .orderBy('priority', 'desc')

      // Récupérer les images des produits pour chaque offre flash
      const flashSalesWithProducts = await Promise.all(
        flashSales.map(async (flash) => {
          let imageUrl = flash.image_url
          let products: any[] = []

          if (flash.product_ids) {
            let productIds: string[] = []
            if (typeof flash.product_ids === 'string') {
              try {
                productIds = JSON.parse(flash.product_ids)
              } catch {
                productIds = flash.product_ids.split(',').map(id => id.trim())
              }
            } else if (Array.isArray(flash.product_ids)) {
              productIds = flash.product_ids
            }

            if (productIds.length > 0) {
              products = await Product.query()
                .whereIn('id', productIds)
                .where('is_archived', false)
                .where('status', 'active')
                .select('id', 'name', 'price', 'old_price', 'image_url', 'description', 'category')
              
              if (!imageUrl && products.length > 0 && products[0].image_url) {
                imageUrl = products[0].image_url
              }
            }
          }

          return {
            id: flash.id,
            title: flash.title,
            description: flash.description,
            image_url: imageUrl,
            banner_image: flash.banner_image,
            type: flash.type,
            discount_percentage: flash.discount_percentage,
            discount_amount: flash.discount_amount,
            category: flash.category,
            link: flash.link,
            button_text: flash.button_text,
            min_order_amount: flash.min_order_amount,
            start_date: flash.start_date,
            end_date: flash.end_date,
            status: flash.status,
            priority: flash.priority,
            products: products.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              old_price: p.old_price,
              image_url: p.image_url
            }))
          }
        })
      )

      return response.json({
        success: true,
        data: flashSalesWithProducts,
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Créer une promotion
   */
  async store({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'title',
        'description',
        'image_url',
        'banner_image',
        'type',
        'discount_percentage',
        'discount_amount',
        'category',
        'product_ids',
        'link',
        'button_text',
        'min_order_amount',
        'start_date',
        'end_date',
        'status',
        'priority',
      ])

      // Transformer product_ids en JSON si présent
      if (data.product_ids && typeof data.product_ids === 'string') {
        data.product_ids = JSON.stringify(data.product_ids.split(','))
      }

      const promotion = await Promotion.create(data)

      return response.status(201).json({
        success: true,
        data: promotion,
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Mettre à jour une promotion
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const promotion = await Promotion.find(params.id)

      if (!promotion) {
        return response.status(404).json({
          success: false,
          message: 'Promotion non trouvée',
        })
      }

      const data = request.only([
        'title',
        'description',
        'image_url',
        'banner_image',
        'type',
        'discount_percentage',
        'discount_amount',
        'category',
        'product_ids',
        'link',
        'button_text',
        'min_order_amount',
        'start_date',
        'end_date',
        'status',
        'priority',
      ])

      promotion.merge(data)
      await promotion.save()

      return response.json({
        success: true,
        data: promotion,
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Supprimer une promotion
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const promotion = await Promotion.find(params.id)

      if (!promotion) {
        return response.status(404).json({
          success: false,
          message: 'Promotion non trouvée',
        })
      }

      await promotion.delete()

      return response.json({
        success: true,
        message: 'Promotion supprimée',
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }
}
