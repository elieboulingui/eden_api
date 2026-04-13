import type { HttpContext } from '@adonisjs/core/http'
import Promotion from '#models/promotion'

export default class PromotionsController {
  /**
   * Récupérer toutes les promotions
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

      return response.json({
        success: true,
        data: promotions,
        meta: {
          total: promotions.length,
          status: status,
        },
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Récupérer une promotion spécifique
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

      return response.json({
        success: true,
        data: promotion,
      })
    } catch (error:any) {
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

      return response.json({
        success: true,
        data: banners,
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

      return response.json({
        success: true,
        data: flashSales,
      })
    } catch (error:any) {
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
    } catch (error:any) {
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
    } catch (error:any) {
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
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }
}
