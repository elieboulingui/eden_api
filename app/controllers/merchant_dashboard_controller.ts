// app/controllers/merchant_dashboard_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user' 
import Product from '#models/Product'
import Category from '#models/categories'
import Coupon from '#models/coupon'
import Promotion from '#models/promotion'  
import Database from '@adonisjs/lucid/services/db'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import axios from 'axios'
import Withdrawal from '#models/Withdrawal'
import Service from '#models/Service'
import DailySubscription from '#models/DailySubscription'

export default class MerchantDashboardController {

  // ============================================================
  // 🆕 GESTION DES SERVICES D'ABONNEMENT
  // ============================================================

  /**
   * Récupère tous les services du marchand
   */
  async getMerchantServices({ params, request, response }: HttpContext) {
    try {
      const { merchantId, userId } = params
      const id = merchantId || userId

      if (!id) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const search = request.input('search', '')
      const status = request.input('status', 'all')

      let query = Service.query()
        .where('merchant_id', user.id)
        .preload('merchant', (query) => {
          query.select('id', 'full_name', 'shop_name', 'avatar')
        })
        .orderBy('created_at', 'desc')

      if (search) {
        query = query.where((builder) => {
          builder
            .where('name', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
        })
      }

      if (status !== 'all') {
        query = query.where('is_active', status === 'active')
      }

      const services = await query.paginate(page, limit)

      const servicesWithStats = await Promise.all(services.all().map(async (service) => {
        const activeSubscribers = await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .count('* as total')
          .first()

        const totalRevenue = await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .sum('price_paid as total')
          .first()

        const todaySubscribers = await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .whereRaw('DATE(subscription_date) = CURDATE()')
          .count('* as total')
          .first()

        return {
          ...service.toJSON(),
          merchant_name: service.merchant?.full_name || null,
          merchant_shop_name: service.merchant?.shop_name || null,
          merchant_avatar: service.merchant?.avatar || null,
          active_subscribers: Number.parseInt(activeSubscribers?.$extras?.total) || 0,
          total_revenue: Number.parseFloat(totalRevenue?.$extras?.total) || 0,
          today_subscribers: Number.parseInt(todaySubscribers?.$extras?.total) || 0,
          features: service.features ? JSON.parse(service.features) : null,
          settings: service.settings ? JSON.parse(service.settings) : null,
        }
      }))

      return response.ok({
        success: true,
        data: servicesWithStats,
        pagination: {
          page: services.currentPage,
          perPage: services.perPage,
          total: services.total,
          lastPage: services.lastPage,
          hasMorePages: services.hasMorePages
        },
        count: services.total
      })

    } catch (error: any) {
      console.error('Erreur getMerchantServices:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des services',
        error: error.message
      })
    }
  }

  /**
   * Récupère les détails d'un service spécifique
   */
  async getMerchantServiceDetail({ params, response }: HttpContext) {
    try {
      const { merchantId, userId, serviceId } = params
      const id = merchantId || userId

      if (!id || !serviceId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const service = await Service.query()
        .where('id', serviceId)
        .where('merchant_id', user.id)
        .preload('merchant', (query) => {
          query.select('id', 'full_name', 'shop_name', 'avatar')
        })
        .first()

      if (!service) {
        return response.notFound({ success: false, message: 'Service non trouvé' })
      }

      // Statistiques détaillées
      const activeSubscribers = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .count('* as total')
        .first()

      const totalRevenue = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .sum('price_paid as total')
        .first()

      const todaySubscribers = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .whereRaw('DATE(subscription_date) = CURDATE()')
        .count('* as total')
        .first()

      const expiredSubscribers = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'expired')
        .count('* as total')
        .first()

      const cancelledSubscribers = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'cancelled')
        .count('* as total')
        .first()

      // Récupérer les 5 derniers abonnés
      const recentSubscribers = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .preload('client', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })
        .orderBy('created_at', 'desc')
        .limit(5)

      return response.ok({
        success: true,
        data: {
          ...service.toJSON(),
          merchant_name: service.merchant?.full_name || null,
          merchant_shop_name: service.merchant?.shop_name || null,
          merchant_avatar: service.merchant?.avatar || null,
          features: service.features ? JSON.parse(service.features) : null,
          settings: service.settings ? JSON.parse(service.settings) : null,
          stats: {
            active_subscribers: Number.parseInt(activeSubscribers?.$extras?.total) || 0,
            total_revenue: Number.parseFloat(totalRevenue?.$extras?.total) || 0,
            today_subscribers: Number.parseInt(todaySubscribers?.$extras?.total) || 0,
            expired_subscribers: Number.parseInt(expiredSubscribers?.$extras?.total) || 0,
            cancelled_subscribers: Number.parseInt(cancelledSubscribers?.$extras?.total) || 0,
          },
          recent_subscribers: recentSubscribers.map(sub => ({
            id: sub.id,
            client_id: sub.client_id,
            client_name: sub.client?.full_name || null,
            client_email: sub.client?.email || null,
            client_avatar: sub.client?.avatar || null,
            subscription_date: sub.subscription_date,
            valid_until: sub.valid_until,
            price_paid: sub.price_paid,
            status: sub.status,
          }))
        }
      })

    } catch (error: any) {
      console.error('Erreur getMerchantServiceDetail:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des détails du service',
        error: error.message
      })
    }
  }

  /**
   * Crée un nouveau service d'abonnement
   */
  async createService({ params, request, response }: HttpContext) {
    try {
      const { merchantId, userId } = params
      const id = merchantId || userId

      if (!id) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      // Vérifier si le marchand peut créer des services
      if (!user.can_create_services) {
        return response.forbidden({ 
          success: false, 
          message: 'Vous n\'avez pas l\'autorisation de créer des services. Veuillez souscrire à un plan d\'abonnement.' 
        })
      }

      // Vérifier la limite de services
      const existingServicesCount = await Service.query()
        .where('merchant_id', user.id)
        .where('is_active', true)
        .count('* as total')
        .first()

      const currentCount = Number.parseInt(existingServicesCount?.$extras?.total) || 0
      
      if (currentCount >= user.max_services) {
        return response.forbidden({
          success: false,
          message: `Vous avez atteint la limite de ${user.max_services} services. Passez à un plan supérieur pour créer plus de services.`
        })
      }

      const data = request.only([
        'name',
        'description',
        'price',
        'currency',
        'category',
        'subscription_type',
        'duration_days',
        'trial_days',
        'has_trial',
        'max_subscribers',
        'is_unlimited',
        'max_uses_per_day',
        'image_url',
        'cover_image_url',
        'features',
        'settings'
      ])

      // Validation
      if (!data.name) {
        return response.badRequest({ success: false, message: 'Le nom du service est requis' })
      }

      if (!data.price || data.price <= 0) {
        return response.badRequest({ success: false, message: 'Le prix est requis et doit être supérieur à 0' })
      }

      // Vérifier les doublons
      const existingService = await Service.query()
        .where('name', data.name)
        .where('merchant_id', user.id)
        .first()

      if (existingService) {
        return response.conflict({
          success: false,
          message: 'Un service avec le même nom existe déjà',
          data: { existing_service_id: existingService.id }
        })
      }

      // Créer le service
      const service = new Service()
      service.id = crypto.randomUUID()
      service.merchant_id = user.id
      service.name = data.name.trim()
      service.description = data.description || null
      service.price = Number(data.price)
      service.currency = data.currency || 'XAF'
      service.category = data.category || null
      service.is_active = true
      service.subscription_type = data.subscription_type || 'daily'
      service.duration_days = data.duration_days || null
      service.trial_days = data.trial_days || 0
      service.has_trial = data.has_trial || false
      service.max_subscribers = data.max_subscribers || null
      service.is_unlimited = data.is_unlimited !== undefined ? data.is_unlimited : true
      service.max_uses_per_day = data.max_uses_per_day || null
      service.image_url = data.image_url || null
      service.cover_image_url = data.cover_image_url || null
      service.features = data.features ? JSON.stringify(data.features) : null
      service.settings = data.settings ? JSON.stringify(data.settings) : null
      service.total_subscribers = 0
      service.total_revenue = 0
      service.average_rating = 0
      service.total_reviews = 0

      await service.save()

      // Mettre à jour le compte utilisateur
      user.active_subscriptions_count = (user.active_subscriptions_count || 0) + 1
      await user.save()

      await service.load('merchant', (query) => {
        query.select('id', 'full_name', 'shop_name', 'avatar')
      })

      return response.created({
        success: true,
        message: `Service "${service.name}" créé avec succès`,
        data: {
          ...service.toJSON(),
          merchant_name: service.merchant?.full_name || null,
          merchant_shop_name: service.merchant?.shop_name || null,
          merchant_avatar: service.merchant?.avatar || null,
          features: service.features ? JSON.parse(service.features) : null,
          settings: service.settings ? JSON.parse(service.settings) : null,
        }
      })

    } catch (error: any) {
      console.error('Erreur createService:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création du service',
        error: error.message
      })
    }
  }

  /**
   * Met à jour un service existant
   */
  async updateService({ params, request, response }: HttpContext) {
    try {
      const { merchantId, userId, serviceId } = params
      const id = merchantId || userId

      if (!id || !serviceId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const service = await Service.query()
        .where('id', serviceId)
        .where('merchant_id', user.id)
        .first()

      if (!service) {
        return response.notFound({ success: false, message: 'Service non trouvé' })
      }

      const data = request.only([
        'name',
        'description',
        'price',
        'currency',
        'category',
        'subscription_type',
        'duration_days',
        'trial_days',
        'has_trial',
        'max_subscribers',
        'is_unlimited',
        'max_uses_per_day',
        'image_url',
        'cover_image_url',
        'features',
        'settings',
        'is_active'
      ])

      // Mise à jour des champs
      if (data.name) service.name = data.name.trim()
      if (data.description !== undefined) service.description = data.description
      if (data.price !== undefined) service.price = Number(data.price)
      if (data.currency) service.currency = data.currency
      if (data.category !== undefined) service.category = data.category
      if (data.subscription_type) service.subscription_type = data.subscription_type
      if (data.duration_days !== undefined) service.duration_days = data.duration_days
      if (data.trial_days !== undefined) service.trial_days = data.trial_days
      if (data.has_trial !== undefined) service.has_trial = data.has_trial
      if (data.max_subscribers !== undefined) service.max_subscribers = data.max_subscribers
      if (data.is_unlimited !== undefined) service.is_unlimited = data.is_unlimited
      if (data.max_uses_per_day !== undefined) service.max_uses_per_day = data.max_uses_per_day
      if (data.image_url !== undefined) service.image_url = data.image_url
      if (data.cover_image_url !== undefined) service.cover_image_url = data.cover_image_url
      if (data.is_active !== undefined) service.is_active = data.is_active
      if (data.features !== undefined) service.features = data.features ? JSON.stringify(data.features) : null
      if (data.settings !== undefined) service.settings = data.settings ? JSON.stringify(data.settings) : null

      await service.save()

      await service.load('merchant', (query) => {
        query.select('id', 'full_name', 'shop_name', 'avatar')
      })

      return response.ok({
        success: true,
        message: `Service "${service.name}" mis à jour avec succès`,
        data: {
          ...service.toJSON(),
          merchant_name: service.merchant?.full_name || null,
          merchant_shop_name: service.merchant?.shop_name || null,
          merchant_avatar: service.merchant?.avatar || null,
          features: service.features ? JSON.parse(service.features) : null,
          settings: service.settings ? JSON.parse(service.settings) : null,
        }
      })

    } catch (error: any) {
      console.error('Erreur updateService:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la mise à jour du service',
        error: error.message
      })
    }
  }

  /**
   * Supprime (désactive) un service
   */
  async deleteService({ params, response }: HttpContext) {
    try {
      const { merchantId, userId, serviceId } = params
      const id = merchantId || userId

      if (!id || !serviceId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const service = await Service.query()
        .where('id', serviceId)
        .where('merchant_id', user.id)
        .first()

      if (!service) {
        return response.notFound({ success: false, message: 'Service non trouvé' })
      }

      // Vérifier si des abonnements actifs existent
      const activeSubscriptions = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .count('* as total')
        .first()

      const activeCount = Number.parseInt(activeSubscriptions?.$extras?.total) || 0

      if (activeCount > 0) {
        return response.conflict({
          success: false,
          message: `Impossible de supprimer ce service car ${activeCount} abonné(s) y sont encore actifs. Veuillez d'abord résilier les abonnements.`,
          data: { active_subscribers: activeCount }
        })
      }

      // Désactiver le service
      service.is_active = false
      await service.save()

      // Mettre à jour le compte utilisateur
      user.active_subscriptions_count = Math.max(0, (user.active_subscriptions_count || 0) - 1)
      await user.save()

      return response.ok({
        success: true,
        message: `Service "${service.name}" désactivé avec succès`,
        data: {
          id: service.id,
          name: service.name,
          is_active: service.is_active,
          deleted_at: DateTime.now().toISO()
        }
      })

    } catch (error: any) {
      console.error('Erreur deleteService:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la suppression du service',
        error: error.message
      })
    }
  }

  /**
   * Active ou désactive un service
   */
  async toggleServiceStatus({ params, request, response }: HttpContext) {
    try {
      const { merchantId, userId, serviceId } = params
      const id = merchantId || userId

      if (!id || !serviceId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const service = await Service.query()
        .where('id', serviceId)
        .where('merchant_id', user.id)
        .first()

      if (!service) {
        return response.notFound({ success: false, message: 'Service non trouvé' })
      }

      const { is_active } = request.only(['is_active'])

      // Si on désactive, vérifier les abonnements actifs
      if (is_active === false || is_active === 'false') {
        const activeSubscriptions = await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .count('* as total')
          .first()

        const activeCount = Number.parseInt(activeSubscriptions?.$extras?.total) || 0

        if (activeCount > 0) {
          return response.conflict({
            success: false,
            message: `Impossible de désactiver ce service car ${activeCount} abonné(s) y sont encore actifs.`,
            data: { active_subscribers: activeCount }
          })
        }
      }

      service.is_active = is_active === true || is_active === 'true'
      await service.save()

      return response.ok({
        success: true,
        message: `Service "${service.name}" ${service.is_active ? 'activé' : 'désactivé'} avec succès`,
        data: {
          id: service.id,
          name: service.name,
          is_active: service.is_active
        }
      })

    } catch (error: any) {
      console.error('Erreur toggleServiceStatus:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du changement de statut du service',
        error: error.message
      })
    }
  }

  /**
   * Récupère les abonnés d'un service spécifique
   */
  async getServiceSubscribers({ params, request, response }: HttpContext) {
    try {
      const { merchantId, userId, serviceId } = params
      const id = merchantId || userId

      if (!id || !serviceId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const service = await Service.query()
        .where('id', serviceId)
        .where('merchant_id', user.id)
        .first()

      if (!service) {
        return response.notFound({ success: false, message: 'Service non trouvé' })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status', 'active')

      let query = DailySubscription.query()
        .where('service_id', service.id)
        .preload('client', (query) => {
          query.select('id', 'full_name', 'email', 'avatar', 'phone')
        })
        .orderBy('subscription_date', 'desc')

      if (status !== 'all') {
        query = query.where('status', status)
      }

      const subscriptions = await query.paginate(page, limit)

      const data = subscriptions.all().map((sub) => ({
        id: sub.id,
        client_id: sub.client_id,
        client_name: sub.client?.full_name || null,
        client_email: sub.client?.email || null,
        client_avatar: sub.client?.avatar || null,
        client_phone: sub.client?.phone || null,
        subscription_date: sub.subscription_date,
        valid_until: sub.valid_until,
        price_paid: sub.price_paid,
        currency: sub.currency,
        status: sub.status,
        auto_renew: sub.auto_renew,
        daysRemaining: sub.daysRemaining,
        hoursRemaining: sub.hoursRemaining,
        isActive: sub.isActive,
        isExpired: sub.isExpired,
        payment_method: sub.payment_method,
        created_at: sub.created_at
      }))

      // Statistiques
      const stats = {
        total: await DailySubscription.query()
          .where('service_id', service.id)
          .count('* as total')
          .then(r => Number.parseInt(r[0].$extras.total) || 0),
        active: await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .count('* as total')
          .then(r => Number.parseInt(r[0].$extras.total) || 0),
        expired: await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'expired')
          .count('* as total')
          .then(r => Number.parseInt(r[0].$extras.total) || 0),
        cancelled: await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'cancelled')
          .count('* as total')
          .then(r => Number.parseInt(r[0].$extras.total) || 0),
        total_revenue: await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .sum('price_paid as total')
          .then(r => Number.parseFloat(r[0].$extras.total) || 0)
      }

      return response.ok({
        success: true,
        data: data,
        stats: stats,
        pagination: {
          page: subscriptions.currentPage,
          perPage: subscriptions.perPage,
          total: subscriptions.total,
          lastPage: subscriptions.lastPage
        }
      })

    } catch (error: any) {
      console.error('Erreur getServiceSubscribers:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des abonnés',
        error: error.message
      })
    }
  }

  /**
   * Récupère les statistiques d'un service
   */
  async getServiceStats({ params, response }: HttpContext) {
    try {
      const { merchantId, userId, serviceId } = params
      const id = merchantId || userId

      if (!id || !serviceId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', id)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const service = await Service.query()
        .where('id', serviceId)
        .where('merchant_id', user.id)
        .first()

      if (!service) {
        return response.notFound({ success: false, message: 'Service non trouvé' })
      }

      // Statistiques globales
      const totalSubscriptions = await DailySubscription.query()
        .where('service_id', service.id)
        .count('* as total')
        .first()

      const activeSubscriptions = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .count('* as total')
        .first()

      const expiredSubscriptions = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'expired')
        .count('* as total')
        .first()

      const cancelledSubscriptions = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'cancelled')
        .count('* as total')
        .first()

      // Revenus
      const totalRevenue = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .sum('price_paid as total')
        .first()

      const todayRevenue = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .whereRaw('DATE(subscription_date) = CURDATE()')
        .sum('price_paid as total')
        .first()

      const thisMonthRevenue = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .whereRaw('MONTH(subscription_date) = MONTH(CURDATE())')
        .whereRaw('YEAR(subscription_date) = YEAR(CURDATE())')
        .sum('price_paid as total')
        .first()

      // Statistiques par type d'abonnement
      const subscriptionsByType = await DailySubscription.query()
        .where('service_id', service.id)
        .where('status', 'active')
        .select('subscription_type')
        .count('* as total')
        .groupBy('subscription_type')

      // Statistiques par mois (12 derniers mois)
      const monthlyStats = []
      for (let i = 0; i < 12; i++) {
        const month = DateTime.now().minus({ months: i })
        const monthStart = month.startOf('month')
        const monthEnd = month.endOf('month')

        const count = await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .where('subscription_date', '>=', monthStart.toSQL())
          .where('subscription_date', '<=', monthEnd.toSQL())
          .count('* as total')
          .first()

        const revenue = await DailySubscription.query()
          .where('service_id', service.id)
          .where('status', 'active')
          .where('subscription_date', '>=', monthStart.toSQL())
          .where('subscription_date', '<=', monthEnd.toSQL())
          .sum('price_paid as total')
          .first()

        monthlyStats.unshift({
          month: month.toFormat('MMM yyyy'),
          year: month.year,
          month_number: month.month,
          count: Number.parseInt(count?.$extras?.total) || 0,
          revenue: Number.parseFloat(revenue?.$extras?.total) || 0
        })
      }

      return response.ok({
        success: true,
        data: {
          service_id: service.id,
          service_name: service.name,
          stats: {
            total_subscriptions: Number.parseInt(totalSubscriptions?.$extras?.total) || 0,
            active_subscriptions: Number.parseInt(activeSubscriptions?.$extras?.total) || 0,
            expired_subscriptions: Number.parseInt(expiredSubscriptions?.$extras?.total) || 0,
            cancelled_subscriptions: Number.parseInt(cancelledSubscriptions?.$extras?.total) || 0,
            total_revenue: Number.parseFloat(totalRevenue?.$extras?.total) || 0,
            today_revenue: Number.parseFloat(todayRevenue?.$extras?.total) || 0,
            this_month_revenue: Number.parseFloat(thisMonthRevenue?.$extras?.total) || 0,
          },
          subscriptions_by_type: subscriptionsByType.map(s => ({
            type: s.subscription_type,
            count: Number.parseInt(s.$extras.total) || 0
          })),
          monthly_stats: monthlyStats
        }
      })

    } catch (error: any) {
      console.error('Erreur getServiceStats:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des statistiques du service',
        error: error.message
      })
    }
  }

  // ============================================================
  // 🛒 GESTION DES PRODUITS ARCHIVÉS
  // ============================================================

  async getArchivedProducts({ params, request, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Seuls les marchands peuvent accéder à cette ressource' })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const search = request.input('search', '')

      let query = Product.query()
        .where('user_id', user.id)
        .where('is_archived', true)
        .preload('categoryRelation')
        .orderBy('updated_at', 'desc')

      if (search) {
        query = query.where((builder) => {
          builder
            .where('name', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
        })
      }

      const products = await query.paginate(page, limit)

      const transformedProducts = products.all().map((product: any) => {
        let categoryName = 'Sans catégorie'

        if (product.categoryRelation) {
          categoryName = product.categoryRelation.name
        } else if (product.category) {
          categoryName = product.category
        }

        const archivedDate = DateTime.fromJSDate(product.updatedAt.toJSDate())
        const daysSinceArchived = Math.floor(DateTime.now().diff(archivedDate, 'days').days)

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          old_price: product.old_price,
          stock: product.stock,
          image_url: product.image_url,
          category: categoryName,
          category_id: product.category_id,
          origin: product.origin,
          weight: product.weight,
          packaging: product.packaging,
          conservation: product.conservation,
          color: product.color || null,
          size: product.size || null,
          is_new: product.isNew,
          is_on_sale: product.isOnSale,
          rating: product.rating,
          sales: product.sales || 0,
          status: product.status || 'archived',
          created_at: product.createdAt,
          updated_at: product.updatedAt,
          archived_at: product.updatedAt,
          days_since_archived: daysSinceArchived,
          can_be_restored: true,
          is_permanently_deleted: false
        }
      })

      const totalArchivedProducts = await Product.query()
        .where('user_id', user.id)
        .where('is_archived', true)
        .count('* as total')

      const stats = {
        total_archived: parseInt(totalArchivedProducts[0].$extras.total) || 0,
        archived_this_month: await Product.query()
          .where('user_id', user.id)
          .where('is_archived', true)
          .where('updated_at', '>=', DateTime.now().startOf('month').toSQL())
          .count('* as total')
          .then(result => parseInt(result[0].$extras.total) || 0),
        oldest_archived: products.all().length > 0 
          ? products.all().reduce((oldest, p) => 
              p.updatedAt < oldest.updatedAt ? p : oldest
            ).updatedAt
          : null
      }

      return response.ok({
        success: true,
        data: transformedProducts,
        meta: {
          total: products.total,
          per_page: products.perPage,
          current_page: products.currentPage,
          last_page: products.lastPage,
          first_page: 1,
          first_page_url: `/api/merchant/${userId}/archived-products?page=1`,
          last_page_url: `/api/merchant/${userId}/archived-products?page=${products.lastPage}`,
          next_page_url: products.currentPage < products.lastPage 
            ? `/api/merchant/${userId}/archived-products?page=${products.currentPage + 1}` 
            : null,
          previous_page_url: products.currentPage > 1 
            ? `/api/merchant/${userId}/archived-products?page=${products.currentPage - 1}` 
            : null
        },
        stats: stats,
        count: transformedProducts.length,
        message: `${stats.total_archived} produit(s) archivé(s) trouvé(s)`
      })

    } catch (error: any) {
      console.error('Erreur dans getArchivedProducts:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des produits archivés',
        error: error.message
      })
    }
  }

  async restoreArchivedProduct({ params, response }: HttpContext) {
    try {
      const { userId, productId } = params

      if (!userId || !productId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const product = await Product.query()
        .where('id', productId)
        .where('user_id', user.id)
        .first()

      if (!product) {
        return response.notFound({ success: false, message: 'Produit non trouvé' })
      }

      if (!product.isArchived) {
        return response.badRequest({
          success: false,
          message: 'Ce produit n\'est pas archivé'
        })
      }

      product.isArchived = false
      product.isNew = false
      await product.save()

      await product.load('categoryRelation')

      let categoryName = 'Sans catégorie'
      if (product.categoryRelation) {
        categoryName = product.categoryRelation.name
      }

      return response.ok({
        success: true,
        message: 'Produit restauré avec succès',
        data: {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          category: categoryName,
          is_archived: product.isArchived,
          restored_at: DateTime.now().toISO()
        }
      })

    } catch (error: any) {
      console.error('Erreur dans restoreArchivedProduct:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la restauration du produit',
        error: error.message
      })
    }
  }

  async permanentlyDeleteProduct({ params, response }: HttpContext) {
    try {
      const { userId, productId } = params

      if (!userId || !productId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const product = await Product.query()
        .where('id', productId)
        .where('user_id', user.id)
        .first()

      if (!product) {
        return response.notFound({ success: false, message: 'Produit non trouvé' })
      }

      if (!product.isArchived) {
        return response.badRequest({
          success: false,
          message: 'Seuls les produits archivés peuvent être supprimés définitivement. Archivez d\'abord le produit.'
        })
      }

      const productName = product.name
      const productId_deleted = product.id

      await product.delete()

      return response.ok({
        success: true,
        message: `Le produit "${productName}" a été supprimé définitivement`,
        data: {
          id: productId_deleted,
          name: productName,
          deleted_at: DateTime.now().toISO()
        }
      })

    } catch (error: any) {
      console.error('Erreur dans permanentlyDeleteProduct:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la suppression définitive du produit',
        error: error.message
      })
    }
  }

  // ============================================================
  // 💳 GESTION DU WALLET
  // ============================================================

  async getWallet({ params, response }: HttpContext) {
    try {
      const { userId } = params

      console.log('getWallet called for userId:', userId)

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      let wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      if (!wallet) {
        wallet = await Wallet.create({
          user_id: user.id,
          balance: 0,
          currency: 'XAF',
          status: 'active'
        })
      }

      return response.ok({
        success: true,
        data: {
          id: wallet.id,
          user_id: wallet.user_id,
          balance: wallet.balance,
          currency: wallet.currency,
          status: wallet.status,
          created_at: wallet.created_at,
          updated_at: wallet.updated_at
        }
      })

    } catch (error: any) {
      console.error('Erreur dans getWallet:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async giveChange({ request, response }: HttpContext) {
    try {
      const {
        userId,
        amount,
        customer_account_number,
        operator_code,
        payment_api_key_public,
        payment_api_key_secret,
        notes
      } = request.only([
        'userId',
        'amount',
        'customer_account_number',
        'operator_code',
        'payment_api_key_public',
        'payment_api_key_secret',
        'notes'
      ])

      console.log('=== GIVE_CHANGE PAR MARCHAND ===')
      console.log('userId:', userId)
      console.log('amount:', amount)
      console.log('customer_account_number:', customer_account_number)
      console.log('operator_code:', operator_code)

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      if (!amount || amount <= 0) {
        return response.badRequest({ success: false, message: "Montant invalide" })
      }

      if (amount < 150) {
        return response.badRequest({ success: false, message: "Le montant minimum est de 150 FCFA" })
      }

      if (!customer_account_number) {
        return response.badRequest({ success: false, message: "Numéro de compte client requis" })
      }

      if (!payment_api_key_public || !payment_api_key_secret) {
        return response.badRequest({ success: false, message: "Clés API requises" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Seuls les marchands peuvent faire des retraits' })
      }

      let wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      if (!wallet) {
        wallet = await Wallet.create({
          user_id: user.id,
          balance: 0,
          currency: 'XAF',
          status: 'active'
        })
      }

      if (wallet.balance < amount) {
        return response.badRequest({
          success: false,
          message: `Solde insuffisant. Votre solde actuel est de ${wallet.balance.toLocaleString()} FCFA. Montant demandé: ${amount.toLocaleString()} FCFA.`,
          data: {
            current_balance: wallet.balance,
            requested_amount: amount,
            deficit: amount - wallet.balance,
            needed: amount - wallet.balance
          }
        })
      }

      console.log('🔵 Appel API GIVE_CHANGE externe...')

      const giveChangeResponse = await axios.post(
        'https://api-akiba-1.onrender.com/api/give-change',
        {
          amount: amount,
          customer_account_number: customer_account_number,
          payment_api_key_public: "pk_1773325888803_dt8diavuh3h",
          payment_api_key_secret: "sk_1773325888803_qt015a3cr5",
          free_info: notes || `Retrait marchand ${user.full_name}`
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      const giveChangeResult = giveChangeResponse.data
      console.log('✅ Réponse GIVE_CHANGE:', JSON.stringify(giveChangeResult, null, 2))

      if (!giveChangeResult.success) {
        return response.status(500).json({
          success: false,
          message: giveChangeResult.message || "Erreur lors du traitement du retrait",
          error: giveChangeResult.error
        })
      }

      const subtracted = await wallet.subtractBalance(amount)

      if (!subtracted) {
        return response.status(500).json({
          success: false,
          message: "Erreur lors du débit du wallet. Veuillez contacter le support.",
          data: {
            give_change_success: true,
            wallet_update_failed: true,
            amount: amount
          }
        })
      }

      const withdrawalReference = `WDL-${Date.now()}-${Math.floor(Math.random() * 10000)}`

      const hasWithdrawalsTable = await Database.rawQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'merchant_withdrawals'
        )
      `)

      if (hasWithdrawalsTable.rows[0].exists) {
        await Database.table('merchant_withdrawals').insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          amount: amount,
          status: 'completed',
          payment_method: operator_code || 'mobile_money',
          account_number: customer_account_number,
          account_name: user.full_name,
          operator: operator_code,
          reference: withdrawalReference,
          transaction_id: giveChangeResult.data?.reference_id || null,
          notes: notes || null,
          processed_by: user.id,
          processed_at: DateTime.now().toSQL(),
          created_at: DateTime.now().toSQL(),
          updated_at: DateTime.now().toSQL()
        })
      }

      await Database.table('transactions').insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        amount: amount,
        type: 'withdrawal',
        status: 'completed',
        reference: withdrawalReference,
        description: `Retrait via ${operator_code || 'mobile_money'} vers ${customer_account_number}`,
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL()
      })

      return response.ok({
        success: true,
        message: "Retrait effectué avec succès",
        data: {
          withdrawal_reference: withdrawalReference,
          amount: amount,
          new_balance: wallet.balance,
          old_balance: wallet.balance + amount,
          transaction: giveChangeResult.data,
          customer_account: customer_account_number,
          operator: operator_code,
          date: DateTime.now().toISO()
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur dans giveChange:', error)

      if (error.code === 'ECONNREFUSED') {
        return response.status(503).json({
          success: false,
          message: "Service de paiement indisponible. Veuillez réessayer plus tard.",
          error: error.message
        })
      }

      if (error.response?.status === 401) {
        return response.status(401).json({
          success: false,
          message: "Erreur d'authentification avec le service de paiement. Clés API invalides.",
          error: error.message
        })
      }

      if (error.response?.status === 403) {
        return response.status(403).json({
          success: false,
          message: "Solde marchand insuffisant sur le service de paiement.",
          error: error.message,
          details: error.response?.data
        })
      }

      return response.status(500).json({
        success: false,
        message: error.message || "Erreur lors du retrait",
        error: error.message
      })
    }
  }

  async getWithdrawalHistory({ params, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const withdrawals = await Withdrawal.query()
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')

      console.log(`📦 ${withdrawals.length} retrait(s) trouvé(s) pour l'utilisateur ${userId}`)

      const formattedWithdrawals = withdrawals.map(w => ({
        id: w.id,
        amount: w.net_amount || w.amount,
        status: w.status,
        payment_method: w.payment_method,
        account_number: w.account_number,
        account_name: w.account_name,
        operator: w.operator,
        reference: w.reference,
        created_at: w.created_at,
        fee: w.fee,
        net_amount: w.net_amount
      }))

      const completed = formattedWithdrawals.filter(w => w.status === 'completed')
      const pending = formattedWithdrawals.filter(w => w.status === 'pending' || w.status === 'processing')
      const failed = formattedWithdrawals.filter(w => w.status === 'failed' || w.status === 'cancelled')
      
      const totalWithdrawn = completed.reduce((sum, w) => sum + Number(w.amount), 0)

      const wallet = await Wallet.query().where('user_id', user.id).first()
      const currentBalance = wallet ? wallet.balance : 0

      return response.ok({
        success: true,
        data: formattedWithdrawals,
        stats: {
          total_withdrawn: totalWithdrawn,
          total_withdrawals: withdrawals.length,
          completed_count: completed.length,
          pending_count: pending.length,
          failed_count: failed.length
        },
        count: withdrawals.length,
        current_balance: currentBalance
      })

    } catch (error: any) {
      console.error('Erreur dans getWithdrawalHistory:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async getWithdrawalStats({ request, response }: HttpContext) {
    try {
      const userId = request.qs().userId || request.input('userId')

      if (!userId) {
        return response.badRequest({ 
          success: false, 
          message: "Paramètre userId manquant" 
        })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ 
          success: false, 
          message: 'Utilisateur non trouvé' 
        })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ 
          success: false, 
          message: 'Accès réservé aux marchands' 
        })
      }

      const wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      const currentBalance = wallet ? wallet.balance : 0

      const hasWithdrawalsTable = await Database.rawQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'merchant_withdrawals'
        )
      `)

      let withdrawals: any[] = []

      if (hasWithdrawalsTable.rows[0].exists) {
        withdrawals = await Database
          .from('merchant_withdrawals')
          .where('user_id', user.id)
          .orderBy('created_at', 'desc')
      }

      const completed = withdrawals.filter(w => w.status === 'completed')
      const pending = withdrawals.filter(w => w.status === 'pending')
      const failed = withdrawals.filter(w => w.status === 'failed')

      const totalWithdrawn = completed.reduce((sum, w) => sum + Number(w.amount), 0)
      const averageWithdrawal = completed.length > 0 ? totalWithdrawn / completed.length : 0

      const lastWithdrawal = withdrawals.length > 0 ? {
        id: withdrawals[0].id,
        amount: Number(withdrawals[0].amount),
        status: withdrawals[0].status,
        payment_method: withdrawals[0].payment_method,
        account_number: withdrawals[0].account_number,
        account_name: withdrawals[0].account_name,
        operator: withdrawals[0].operator,
        reference: withdrawals[0].reference,
        created_at: withdrawals[0].created_at
      } : null

      const monthlyStats: { month: string; amount: number; count: number }[] = []
      const now = DateTime.now()
      const twoYearsAgo = now.minus({ years: 2 })

      for (let i = 0; i <= 24; i++) {
        const monthDate = now.minus({ months: i })
        if (monthDate < twoYearsAgo) continue

        const monthStr = monthDate.toFormat('yyyy-MM')
        const monthName = monthDate.toFormat('MMM yyyy')

        const monthWithdrawals = completed.filter(w => {
          const wDate = DateTime.fromSQL(w.created_at)
          return wDate.toFormat('yyyy-MM') === monthStr
        })

        monthlyStats.unshift({
          month: monthName,
          amount: monthWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0),
          count: monthWithdrawals.length
        })
      }

      const operatorStats: { operator: string; amount: number; count: number }[] = []
      const operatorMap = new Map<string, { amount: number; count: number }>()

      for (const w of completed) {
        const operator = w.operator || w.payment_method || 'Autre'
        const existing = operatorMap.get(operator) || { amount: 0, count: 0 }
        operatorMap.set(operator, {
          amount: existing.amount + Number(w.amount),
          count: existing.count + 1
        })
      }

      for (const [operator, data] of operatorMap) {
        operatorStats.push({
          operator,
          amount: data.amount,
          count: data.count
        })
      }

      operatorStats.sort((a, b) => b.amount - a.amount)

      const summary = {
        totalWithdrawn,
        totalWithdrawals: withdrawals.length,
        completedWithdrawals: completed.length,
        pendingWithdrawals: pending.length,
        failedWithdrawals: failed.length,
        averageWithdrawal,
        currentBalance
      }

      return response.ok({
        success: true,
        data: {
          summary,
          monthly: monthlyStats,
          by_operator: operatorStats,
          last_withdrawal: lastWithdrawal,
          current_balance: currentBalance
        }
      })

    } catch (error: any) {
      console.error('Erreur dans getWithdrawalStats:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des statistiques'
      })
    }
  }

  // ============================================================
  // 📦 GESTION DES COMMANDES
  // ============================================================

  async getMerchantOrders({ params, response }: HttpContext) {
    try {
      const { userId } = params

      console.log('getMerchantOrders called for userId:', userId)

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .where('is_archived', false)
        .select('id', 'name', 'price', 'image_url')

      const productIds = merchantProducts.map(p => p.id)

      console.log(`📦 Produits du marchand: ${productIds.length} IDs`)

      if (productIds.length === 0) {
        return response.ok({
          success: true,
          data: [],
          stats: {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            processingOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            totalItems: 0,
            averageOrderValue: 0
          }
        })
      }

      const orderItems = await OrderItem.query()
        .whereIn('product_id', productIds)
        .preload('order', (orderQuery) => {
          orderQuery
            .preload('user', (userQuery) => {
              userQuery.select('id', 'full_name', 'email')
            })
            .orderBy('created_at', 'desc')
        })
        .preload('product')

      console.log(`🛒 OrderItems trouvés: ${orderItems.length}`)

      if (orderItems.length === 0) {
        return response.ok({
          success: true,
          data: [],
          stats: {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            processingOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            totalItems: 0,
            averageOrderValue: 0
          }
        })
      }

      const ordersMap = new Map()

      for (const item of orderItems) {
        const order = item.order
        if (!order) continue

        if (!ordersMap.has(order.id)) {
          const tracking = await OrderTracking.query()
            .where('order_id', order.id)
            .orderBy('tracked_at', 'desc')
            .first()

          ordersMap.set(order.id, {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            total: order.total,
            subtotal: order.subtotal,
            shipping_cost: order.shipping_cost,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            shipping_address: order.shipping_address,
            payment_method: order.payment_method,
            tracking_number: order.tracking_number,
            created_at: order.created_at,
            estimated_delivery: order.estimated_delivery,
            delivered_at: order.delivered_at,
            notes: order.notes,
            items: [],
            tracking: tracking ? {
              status: tracking.status,
              description: tracking.description,
              location: tracking.location,
              tracked_at: tracking.tracked_at
            } : null,
            user: order.user ? {
              id: order.user.id,
              full_name: order.user.full_name,
              email: order.user.email
            } : null
          })
        }

        const orderData = ordersMap.get(order.id)
        const productBelongsToMerchant = merchantProducts.some(p => p.id === item.product_id)

        if (productBelongsToMerchant) {
          orderData.items.push({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name || item.product?.name || 'Produit',
            product_description: item.product_description || item.product?.description || null,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal || (item.price * item.quantity),
            category: item.category,
            image: item.image || item.product?.image_url || null
          })
        }
      }

      const orders = Array.from(ordersMap.values())
      const ordersWithMerchantItems = orders.filter(order => order.items.length > 0)

      ordersWithMerchantItems.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      const stats = {
        totalOrders: ordersWithMerchantItems.length,
        totalRevenue: ordersWithMerchantItems.reduce((sum, order) => {
          const merchantRevenue = order.items.reduce((itemSum: number, item: any) => itemSum + item.subtotal, 0)
          return sum + merchantRevenue
        }, 0),
        pendingOrders: ordersWithMerchantItems.filter(o => o.status === 'pending').length,
        processingOrders: ordersWithMerchantItems.filter(o => o.status === 'processing').length,
        shippedOrders: ordersWithMerchantItems.filter(o => o.status === 'shipped').length,
        deliveredOrders: ordersWithMerchantItems.filter(o => o.status === 'delivered').length,
        cancelledOrders: ordersWithMerchantItems.filter(o => o.status === 'cancelled').length,
        totalItems: ordersWithMerchantItems.reduce((sum, order) => sum + order.items.length, 0),
        averageOrderValue: ordersWithMerchantItems.length > 0
          ? ordersWithMerchantItems.reduce((sum, order) => {
            const merchantRevenue = order.items.reduce((itemSum: number, item: any) => itemSum + item.subtotal, 0)
            return sum + merchantRevenue
          }, 0) / ordersWithMerchantItems.length
          : 0
      }

      console.log(`✅ Commandes trouvées: ${ordersWithMerchantItems.length}`)

      return response.ok({
        success: true,
        data: ordersWithMerchantItems,
        stats: stats,
        count: ordersWithMerchantItems.length
      })

    } catch (error: any) {
      console.error('Erreur dans getMerchantOrders:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async getPendingOrders({ params, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .where('is_archived', false)
        .select('id')

      const productIds = merchantProducts.map(p => p.id)

      if (productIds.length === 0) {
        return response.ok({
          success: true,
          data: [],
          count: 0
        })
      }

      const orderItems = await OrderItem.query()
        .whereIn('product_id', productIds)
        .preload('order', (orderQuery) => {
          orderQuery
            .where('status', 'pending')
            .preload('user', (userQuery) => {
              userQuery.select('id', 'full_name', 'email')
            })
        })
        .preload('product')

      const ordersMap = new Map()

      for (const item of orderItems) {
        const order = item.order
        if (!order || order.status !== 'pending') continue

        const productBelongsToMerchant = merchantProducts.some(p => p.id === item.product_id)
        if (!productBelongsToMerchant) continue

        if (!ordersMap.has(order.id)) {
          ordersMap.set(order.id, {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            total: order.total,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            created_at: order.created_at,
            items_count: 0,
            user: order.user ? {
              full_name: order.user.full_name,
              email: order.user.email
            } : null
          })
        }

        const orderData = ordersMap.get(order.id)
        orderData.items_count++
      }

      const pendingOrders = Array.from(ordersMap.values())
      pendingOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return response.ok({
        success: true,
        data: pendingOrders,
        count: pendingOrders.length
      })

    } catch (error: any) {
      console.error('Erreur dans getPendingOrders:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async getOrderDetails({ params, response }: HttpContext) {
    try {
      const { userId, orderId } = params

      if (!userId || !orderId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const order = await Order.query()
        .where('id', orderId)
        .preload('user', (userQuery) => {
          userQuery.select('id', 'full_name', 'email', 'phone')
        })
        .preload('items', (itemsQuery) => {
          itemsQuery.preload('product')
        })
        .first()

      if (!order) {
        return response.notFound({ success: false, message: 'Commande non trouvée' })
      }

      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .where('is_archived', false)
        .select('id')

      const merchantProductIds = merchantProducts.map(p => p.id)
      const hasMerchantProducts = order.items.some(item => merchantProductIds.includes(item.product_id))

      if (!hasMerchantProducts) {
        return response.forbidden({ success: false, message: 'Cette commande ne contient pas de vos produits' })
      }

      const tracking = await OrderTracking.query()
        .where('order_id', order.id)
        .orderBy('tracked_at', 'desc')
        .first()

      return response.ok({
        success: true,
        data: {
          ...order.toJSON(),
          tracking: tracking ? {
            status: tracking.status,
            description: tracking.description,
            location: tracking.location,
            tracked_at: tracking.tracked_at
          } : null,
          merchant_items: order.items.filter(item => merchantProductIds.includes(item.product_id))
        }
      })

    } catch (error: any) {
      console.error('Erreur dans getOrderDetails:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============================================================
  // 📊 DASHBOARD
  // ============================================================

  async dashboard(ctx: HttpContext) {
    const { params, response } = ctx
    const userId = params.userId

    const user = await User.findBy('id', userId)
    if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
      return response.forbidden({ success: false, message: 'Non autorisé' })
    }

    const products = await Product.query()
      .where('user_id', user.id)
      .where('is_archived', false)
      .preload('categoryRelation')
      .orderBy('created_at', 'desc')

    const categories = await Category.query()
      .where('user_id', user.id)
      .orderBy('name', 'asc')

    const coupons = await Coupon.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')

    let wallet = await Wallet.query()
      .where('user_id', user.id)
      .first()

    if (!wallet) {
      wallet = await Wallet.create({
        user_id: user.id,
        balance: 0,
        currency: 'XAF',
        status: 'active'
      })
    }

    const productIds = products.map(p => p.id)
    let likesCountMap: Record<string, number> = {}

    if (productIds.length > 0) {
      try {
        const likesData = await Database
          .from('favorites')
          .select('product_id')
          .count('* as total')
          .whereIn('product_id', productIds)
          .groupBy('product_id')

        likesCountMap = likesData.reduce((acc: Record<string, number>, curr: any) => {
          acc[curr.product_id] = parseInt(curr.total)
          return acc
        }, {})
      } catch (error) {
        console.log('Table favorites non disponible:', error)
      }
    }

    let salesCountMap: Record<string, number> = {}

    if (productIds.length > 0) {
      try {
        const orderItems = await OrderItem.query()
          .whereIn('product_id', productIds)
          .select('product_id')
          .count('* as total')
          .groupBy('product_id')

        salesCountMap = orderItems.reduce((acc: Record<string, number>, curr: any) => {
          acc[curr.product_id] = parseInt(curr.$extras.total)
          return acc
        }, {})
      } catch (error) {
        console.log('Table order_items non disponible:', error)
      }
    }

    const transformedProducts = products.map(p => {
      let categoryName = 'Sans catégorie'
      if (p.categoryRelation) {
        categoryName = p.categoryRelation.name
      } else if (p.category) {
        categoryName = p.category
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        image_url: p.image_url,
        image_url_2: p.imageUrl2 || null,
        image_url_3: p.imageUrl3 || null,
        image_url_4: p.imageUrl4 || null,
        image_url_5: p.imageUrl5 || null,
        color: p.color || null,
        size: p.size || null,
        category: categoryName,
        likes: likesCountMap[p.id] || 0,
        sales: salesCountMap[p.id] || 0,
        status: p.status || 'active',
        created_at: p.createdAt
      }
    })

    const totalLikes = transformedProducts.reduce((sum, p) => sum + p.likes, 0)
    const totalSales = transformedProducts.reduce((sum, p) => sum + p.sales, 0)

    return response.ok({
      success: true,
      data: {
        stats: {
          totalProducts: products.length,
          totalSales: totalSales,
          totalRevenue: 0,
          totalLikes: totalLikes,
          pendingOrders: 0,
        },
        products: transformedProducts,
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image_url: c.image_url || null,
          productCount: c.product_count || 0
        })),
        coupons: coupons,
        salesChart: [],
        pendingOrders: [],
        popularProducts: [],
        merchant: {
          id: user.id,
          uuid: user.id,
          full_name: user.full_name,
          email: user.email,
          avatar: user.avatar || null,
          availableBalance: wallet.balance
        }
      }
    })
  }

  // ============================================================
  // 📦 GESTION DES PRODUITS
  // ============================================================

  async getProducts({ params, request, response }: HttpContext) {
    try {
      const { userId } = params

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.ok({
          success: true,
          data: { data: [], meta: { total: 0 } }
        })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const products = await Product.query()
        .where('user_id', user.id)
        .where('is_archived', false)
        .preload('categoryRelation')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      const productArray = products.all()
      const productIds = productArray.map(p => p.id)

      let favoritesCountMap: Record<string, number> = {}

      if (productIds.length > 0) {
        const favoritesCount = await Database
          .from('favorites')
          .select('product_id')
          .count('* as total')
          .whereIn('product_id', productIds)
          .groupBy('product_id')

        favoritesCountMap = favoritesCount.reduce((acc: Record<string, number>, curr: any) => {
          acc[curr.product_id] = parseInt(curr.total)
          return acc
        }, {})
      }

      const transformedProducts = productArray.map((product: any) => {
        let categoryName = 'Sans catégorie'

        if (product.categoryRelation) {
          categoryName = product.categoryRelation.name
        } else if (product.category) {
          categoryName = product.category
        }

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          image_url: product.image_url,
          image_url_2: product.imageUrl2 || null,
          image_url_3: product.imageUrl3 || null,
          image_url_4: product.imageUrl4 || null,
          image_url_5: product.imageUrl5 || null,
          color: product.color || null,
          size: product.size || null,
          category: categoryName,
          category_id: product.category_id,
          likes: favoritesCountMap[product.id] || 0,
          sales: product.sales || 0,
          status: product.status || 'active',
          created_at: product.createdAt
        }
      })

      return response.ok({
        success: true,
        data: {
          meta: products.getMeta(),
          data: transformedProducts
        }
      })

    } catch (error: any) {
      console.error('Erreur getProducts:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async createProduct({ params, request, response }: HttpContext) {
    try {
      const { userId } = params

      const { 
        name, description, price, stock, category_name, 
        image_url, image_url_2, image_url_3, image_url_4, image_url_5,
        color, size
      } = request.only([
        'name', 'description', 'price', 'stock', 'category_name',
        'image_url', 'image_url_2', 'image_url_3', 'image_url_4', 'image_url_5',
        'color', 'size'
      ])

      console.log('🔵 ========== DÉBUT CRÉATION PRODUIT ==========')
      console.log('📦 Données reçues:', { 
        userId, name, description, price, stock, category_name,
        image_url, image_url_2, image_url_3, image_url_4, image_url_5,
        color, size
      })

      if (!name || name.trim() === '') {
        return response.badRequest({ success: false, message: 'Le nom du produit est requis' })
      }

      const user = await User.findBy('id', userId)
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      console.log('👤 Utilisateur trouvé:', { id: user.id, role: user.role })

      let categoryId: string | null = null
      if (category_name && category_name.trim() !== '') {
        let category = await Category.query()
          .where('name', category_name.trim())
          .where('user_id', user.id)
          .first()

        if (!category) {
          console.log('📁 Catégorie non trouvée, création...')
          category = await Category.create({
            name: category_name.trim(),
            slug: category_name.trim().toLowerCase().replace(/\s+/g, '-'),
            user_id: user.id,
            is_active: true,
          })
          console.log('✅ Catégorie créée:', { id: category.id, name: category.name })
        } else {
          console.log('📁 Catégorie existante trouvée:', { id: category.id, name: category.name })
        }
        categoryId = category.id
      }

      const productData: any = {
        name: name.trim(),
        description: description || '',
        price: parseFloat(price) || 0,
        stock: parseInt(stock) || 0,
        image_url: image_url?.trim() || null,
        imageUrl2: image_url_2?.trim() || null,
        imageUrl3: image_url_3?.trim() || null,
        imageUrl4: image_url_4?.trim() || null,
        imageUrl5: image_url_5?.trim() || null,
        color: color || null,
        size: size || null,
        user_id: user.id,
        category_id: categoryId,
        isNew: true,
        isOnSale: false,
        rating: 0,
        isArchived: false,
        sales: 0,
        likes: 0,
        status: 'active',
        minOrderQuantity: 1,
        isBoosted: false,
        boostMultiplier: 1,
        boostLevel: 'none',
        boostPriority: 0,
        boostViews: 0,
        boostClicks: 0,
        boostSales: 0,
        isFeatured: false,
        isTrending: false,
      }

      console.log('📝 Données du produit à insérer:', JSON.stringify(productData, null, 2))
      console.log('💾 Tentative d\'insertion dans la base de données...')
      const product = await Product.create(productData)
      console.log('✅ Produit créé avec succès:', { id: product.id, name: product.name })

      if (categoryId) {
        const category = await Category.find(categoryId)
        if (category) {
          const ids = Array.isArray(category.product_ids) ? category.product_ids : []
          if (!ids.includes(product.id)) {
            ids.push(product.id)
            category.product_ids = ids
            category.product_count = ids.length
            await category.save()
            console.log('📁 Catégorie mise à jour avec le nouveau produit')
          }
        }
      }

      const images = [
        product.image_url,
        product.imageUrl2,
        product.imageUrl3,
        product.imageUrl4,
        product.imageUrl5
      ].filter(img => img && img.trim() !== '')

      console.log('🔵 ========== FIN CRÉATION PRODUIT (SUCCÈS) ==========')
      
      return response.created({
        success: true,
        data: {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          category_id: product.category_id,
          category_name: category_name || null,
          color: product.color || null,
          size: product.size || null,
          images: images,
          images_count: images.length,
          image_url: product.image_url,
          image_url_2: product.imageUrl2,
          image_url_3: product.imageUrl3,
          image_url_4: product.imageUrl4,
          image_url_5: product.imageUrl5,
        },
        message: `Produit "${name}" créé avec succès`,
      })

    } catch (error: any) {
      console.error('❌ ========== ERREUR CRÉATION PRODUIT ==========')
      console.error('❌ Message d\'erreur:', error.message)
      console.error('❌ Code d\'erreur:', error.code)
      console.error('❌ Détails complets:', error)
      
      if (error.sql) {
        console.error('❌ SQL échoué:', error.sql)
      }
      
      if (error.parameters) {
        console.error('❌ Paramètres:', error.parameters)
      }
      
      console.error('❌ ================================================')
      
      return response.internalServerError({
        success: false,
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? {
          sql: error.sql,
          parameters: error.parameters
        } : undefined
      })
    }
  }

  async updateProduct({ params, request, response }: HttpContext) {
    try {
      const { userId, productId } = params

      const { 
        name, description, price, stock, category_name,
        image_url, image_url_2, image_url_3, image_url_4, image_url_5,
        color, size
      } = request.only([
        'name', 'description', 'price', 'stock', 'category_name',
        'image_url', 'image_url_2', 'image_url_3', 'image_url_4', 'image_url_5',
        'color', 'size'
      ])

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const product = await Product.query()
        .where('id', productId)
        .where('user_id', user.id)
        .first()

      if (!product) {
        return response.notFound({ success: false, message: 'Produit non trouvé' })
      }

      const oldPrice = product.price
      let newPrice = oldPrice

      let categoryId: string | null = null

      if (category_name && category_name.trim() !== '') {
        const category = await Category.query()
          .where('name', category_name)
          .where('user_id', user.id)
          .first()

        if (category) {
          categoryId = category.id
        } else {
          const newCategory = await Category.create({
            name: category_name,
            slug: category_name.toLowerCase().replace(/\s+/g, '-'),
            user_id: user.id,
          })
          categoryId = newCategory.id
        }
      }

      if (name) product.name = name
      if (description !== undefined) product.description = description
      if (price) {
        newPrice = parseFloat(price)
        product.price = newPrice
      }
      if (stock !== undefined) product.stock = parseInt(stock)
      if (categoryId) product.category_id = categoryId
      if (image_url !== undefined) product.image_url = image_url?.trim() || null
      if (image_url_2 !== undefined) product.imageUrl2 = image_url_2?.trim() || null
      if (image_url_3 !== undefined) product.imageUrl3 = image_url_3?.trim() || null
      if (image_url_4 !== undefined) product.imageUrl4 = image_url_4?.trim() || null
      if (image_url_5 !== undefined) product.imageUrl5 = image_url_5?.trim() || null
      if (color !== undefined) product.color = color || null
      if (size !== undefined) product.size = size || null

      let promotionMessage = ''
      let promotionCreated: any = null
      
      if (price && newPrice < oldPrice) {
        const reductionPercent = ((oldPrice - newPrice) / oldPrice) * 100
        
        product.isOnSale = true
        product.isNew = false
        
        if ('old_price' in product) {
          product.old_price = oldPrice
        }

        try {
          const promoEndDate = DateTime.now().plus({ days: 30 })
          
          const promotion = await Promotion.create({
            title: `🔥 ${reductionPercent.toFixed(0)}% sur ${product.name}`,
            description: `Profitez de ${reductionPercent.toFixed(0)}% de réduction sur ${product.name} ! Ancien prix: ${oldPrice} FCFA, Nouveau prix: ${newPrice} FCFA. Offre limitée !`,
            image_url: product.image_url,
            banner_image: product.image_url,
            type: 'flash_sale',
            discount_percentage: Math.round(reductionPercent),
            discount_amount: oldPrice - newPrice,
            category: category_name || null,
            product_ids: JSON.stringify([product.id]),
            link: `/product/${product.id}`,
            button_text: '🌐 Voir le produit',
            min_order_amount: null,
            start_date: DateTime.now(),
            end_date: promoEndDate,
            status: 'active',
            priority: Math.round(reductionPercent),
          })

          promotionCreated = {
            id: promotion.id,
            title: promotion.title,
            discount_percentage: promotion.discount_percentage,
            end_date: promotion.end_date
          }

          promotionMessage = ` ✅ PROMO CRÉÉE : -${reductionPercent.toFixed(0)}% sur "${product.name}" ! Visible jusqu'au ${promoEndDate.toFormat('dd/MM/yyyy')}.`
          
          console.log(`🎉 Promotion créée: ${promotion.title}`)
        } catch (promoError: any) {
          console.error('Erreur création promotion:', promoError)
          promotionMessage = ` ⚠️ Prix réduit de ${reductionPercent.toFixed(0)}% mais la promotion n'a pas pu être créée.`
        }
        
      } else if (price && newPrice >= oldPrice && oldPrice > 0) {
        product.isOnSale = false
        
        try {
          const existingPromos = await Promotion.query()
            .where('product_ids', 'LIKE', `%${product.id}%`)
            .where('status', 'active')
          
          for (const promo of existingPromos) {
            promo.status = 'expired'
            promo.end_date = DateTime.now()
            await promo.save()
            console.log(`🏁 Promotion expirée: ${promo.title}`)
          }

          if (existingPromos.length > 0) {
            promotionMessage += ` ${existingPromos.length} promotion(s) désactivée(s).`
          }
        } catch (err) {
          console.error('Erreur désactivation promotions:', err)
        }
        
        if (newPrice === oldPrice) {
          promotionMessage = ` Prix inchangé (${newPrice} FCFA).` + promotionMessage
        } else {
          const increasePercent = ((newPrice - oldPrice) / oldPrice) * 100
          promotionMessage = ` Prix augmenté de ${increasePercent.toFixed(0)}% (${oldPrice} → ${newPrice} FCFA).` + promotionMessage
        }
      }

      await product.save()

      const updatedProduct = await Product.query()
        .where('id', product.id)
        .preload('categoryRelation')
        .first()

      let categoryNameResult = 'Sans catégorie'
      if (updatedProduct?.categoryRelation) {
        categoryNameResult = updatedProduct.categoryRelation.name
      }

      const images = [
        product.image_url,
        product.imageUrl2,
        product.imageUrl3,
        product.imageUrl4,
        product.imageUrl5
      ].filter(img => img && img.trim() !== '')

      return response.ok({
        success: true,
        message: `Produit "${product.name}" mis à jour.${promotionMessage}`,
        data: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          old_price: oldPrice !== newPrice ? oldPrice : undefined,
          stock: product.stock,
          color: product.color || null,
          size: product.size || null,
          images: images,
          images_count: images.length,
          image_url: product.image_url,
          image_url_2: product.imageUrl2,
          image_url_3: product.imageUrl3,
          image_url_4: product.imageUrl4,
          image_url_5: product.imageUrl5,
          category: categoryNameResult,
          category_id: product.category_id,
          is_on_sale: product.isOnSale,
          is_new: product.isNew,
          price_changed: oldPrice !== newPrice,
          reduction_percent: oldPrice > newPrice ? ((oldPrice - newPrice) / oldPrice) * 100 : 0,
          promotion_active: product.isOnSale,
          promotion: promotionCreated
        }
      })
    } catch (error: any) {
      console.error('Erreur updateProduct:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async deleteProduct({ params, response }: HttpContext) {
    try {
      const { userId, productId } = params
      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const product = await Product.query()
        .where('id', productId)
        .where('user_id', user.id)
        .first()

      if (!product) {
        return response.notFound({ success: false, message: 'Produit non trouvé' })
      }

      if (product.isArchived) {
        return response.badRequest({
          success: false,
          message: 'Ce produit est déjà archivé'
        })
      }

      product.isArchived = true
      await product.save()

      return response.ok({
        success: true,
        message: 'Produit archivé avec succès',
        data: {
          id: product.id,
          is_archived: product.isArchived,
          archived_at: product.updatedAt
        }
      })
    } catch (error: any) {
      console.error('Erreur deleteProduct (archive):', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de l\'archivage du produit'
      })
    }
  }

  // ============================================================
  // 📁 GESTION DES CATÉGORIES
  // ============================================================

  async getCategories({ params, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.badRequest({ success: false, message: 'ID utilisateur requis' })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const categories = await Category.query()
        .where('user_id', user.id)
        .orderBy('name', 'asc')

      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          const productCountResult = await Product.query()
            .where('category_id', category.id)
            .where('user_id', user.id)
            .where('is_archived', false)
            .count('* as total')

          const realCount = parseInt(productCountResult[0].$extras.total) || 0

          return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            image_url: category.image_url || null,
            icon_name: category.icon_name || null,
            product_count: realCount,
            sort_order: category.sort_order ?? 0,
            is_active: category.is_active,
          }
        })
      )

      return response.ok({ 
        success: true, 
        message: 'Catégories récupérées avec succès',
        data: categoriesWithCount,
        count: categoriesWithCount.length,
      })
    } catch (error: any) {
      console.error('ERREUR getCategories:', error)
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  async createCategory({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { name, slug, image_url } = request.only(['name', 'slug', 'image_url'])

      if (!name) {
        return response.badRequest({ success: false, message: 'Le nom est requis' })
      }

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const slugToUse = slug || name.toLowerCase().replace(/\s+/g, '-')

      const category = await Category.create({
        name,
        slug: slugToUse,
        user_id: user.id,
        image_url: image_url || null,
      })

      return response.created({
        success: true,
        data: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          image_url: category.image_url,
          productCount: 0,
        },
        message: 'Catégorie créée',
      })
    } catch (error: any) {
      console.error('ERREUR createCategory:', error)
      return response.internalServerError({
        success: false,
        message: error.message,
      })
    }
  }

  async updateCategory({ params, request, response }: HttpContext) {
    try {
      const { userId, categoryId } = params
      const { name, slug, is_active, image_url } = request.only(['name', 'slug', 'is_active', 'image_url'])

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const category = await Category.query()
        .where('id', categoryId)
        .where('user_id', user.id)
        .first()

      if (!category) {
        return response.notFound({ success: false, message: 'Catégorie non trouvée' })
      }

      if (name) category.name = name
      if (slug) category.slug = slug
      if (is_active !== undefined) category.is_active = is_active
      if (image_url !== undefined) category.image_url = image_url

      await category.save()

      return response.ok({
        success: true,
        data: category,
        message: 'Catégorie mise à jour avec succès'
      })
    } catch (error: any) {
      console.error('Erreur updateCategory:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async deleteCategory({ params, response }: HttpContext) {
    try {
      const { userId, categoryId } = params

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const category = await Category.query()
        .where('id', categoryId)
        .where('user_id', user.id)
        .first()

      if (!category) {
        return response.notFound({ success: false, message: 'Catégorie non trouvée' })
      }

      const productsCount = await Product.query()
        .where('category_id', category.id)
        .count('* as total')

      if (parseInt(productsCount[0].$extras.total) > 0) {
        return response.badRequest({
          success: false,
          message: 'Impossible de supprimer cette catégorie car elle contient des produits'
        })
      }

      await category.delete()

      return response.ok({
        success: true,
        message: 'Catégorie supprimée avec succès'
      })
    } catch (error: any) {
      console.error('Erreur deleteCategory:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============================================================
  // 🎫 GESTION DES COUPONS
  // ============================================================

  async getCoupons({ params, response }: HttpContext) {
    try {
      const { userId } = params
      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.ok({ success: true, data: [] })
      }

      const coupons = await Coupon.query()
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')

      return response.ok({ success: true, data: coupons })
    } catch (error: any) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  async createCoupon({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { code, discount, type, validUntil, usageLimit, productId } = request.only([
        'code', 'discount', 'type', 'validUntil', 'usageLimit', 'productId'
      ])

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const coupon = await Coupon.create({
        code: code.toUpperCase(),
        discount: parseFloat(discount),
        type: type,
        valid_until: validUntil ? DateTime.fromJSDate(new Date(validUntil)) : null,
        usage_limit: usageLimit ? parseInt(usageLimit) : undefined,
        used_count: 0,
        user_id: user.id,
        product_id: productId || null,
        status: 'active'
      })

      return response.created({
        success: true,
        data: coupon,
        message: 'Code promo créé'
      })
    } catch (error: any) {
      console.error('Erreur createCoupon:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async updateCoupon({ params, request, response }: HttpContext) {
    try {
      const { userId, couponId } = params
      const { code, discount, type, validUntil, usageLimit, status } = request.only([
        'code', 'discount', 'type', 'validUntil', 'usageLimit', 'status'
      ])

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const coupon = await Coupon.query()
        .where('id', couponId)
        .where('user_id', user.id)
        .first()

      if (!coupon) {
        return response.notFound({ success: false, message: 'Code promo non trouvé' })
      }

      if (code) coupon.code = code.toUpperCase()
      if (discount) coupon.discount = parseFloat(discount)
      if (type) coupon.type = type
      if (validUntil) coupon.valid_until = DateTime.fromJSDate(new Date(validUntil))
      if (usageLimit) coupon.usage_limit = parseInt(usageLimit)
      if (status) coupon.status = status

      await coupon.save()

      return response.ok({
        success: true,
        data: coupon,
        message: 'Code promo mis à jour avec succès'
      })
    } catch (error: any) {
      console.error('Erreur updateCoupon:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async deleteCoupon({ params, response }: HttpContext) {
    try {
      const { userId, couponId } = params

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const coupon = await Coupon.query()
        .where('id', couponId)
        .where('user_id', user.id)
        .first()

      if (!coupon) {
        return response.notFound({ success: false, message: 'Code promo non trouvé' })
      }

      await coupon.delete()

      return response.ok({
        success: true,
        message: 'Code promo supprimé avec succès'
      })
    } catch (error: any) {
      console.error('Erreur deleteCoupon:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async getStats({ params, response }: HttpContext) {
    try {
      const { userId } = params
      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const totalProducts = await Product.query()
        .where('user_id', user.id)
        .where('is_archived', false)
        .count('* as total')

      return response.ok({
        success: true,
        data: {
          totalProducts: parseInt(totalProducts[0].$extras.total) || 0,
          sales: { today: 0, week: 0, month: 0 },
          totalRevenue: 0,
        }
      })
    } catch (error: any) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  async getRecentOrders({ params, response }: HttpContext) {
    try {
      const { userId } = params
      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.ok({ success: true, data: [] })
      }

      const orders = await Order.query()
        .where('merchant_id', user.id)
        .where('status', 'pending')
        .preload('user', (query) => {
          query.select('id', 'full_name', 'email')
        })
        .orderBy('created_at', 'desc')
        .limit(10)

      const ordersData = orders.map(order => ({
        id: order.id,
        orderNumber: `CMD-${order.id.slice(-8)}`,
        customerName: order.user?.full_name || 'Client',
        total: order.total,
        status: order.status,
        created_at: order.created_at.toISO(),
      }))

      return response.ok({ success: true, data: ordersData })
    } catch (error: any) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  // ============================================================
  // 🚚 ZONES DE LIVRAISON
  // ============================================================

  async getDeliveryZones({ params, response }: HttpContext) {
    try {
      const { userId } = params

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const zones = user.delivery_zones || {}

      return response.ok({
        success: true,
        data: {
          zones: Object.entries(zones).map(([zone, fee]) => ({
            zone: zone.charAt(0).toUpperCase() + zone.slice(1),
            fee,
          })),
          total_zones: Object.keys(zones).length,
        },
      })
    } catch (error: any) {
      console.error('Erreur getDeliveryZones:', error)
      return response.internalServerError({
        success: false,
        message: error.message,
      })
    }
  }

  async upsertDeliveryZone({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { zone, fee } = request.only(['zone', 'fee'])

      console.log('🔵 upsertDeliveryZone:', { userId, zone, fee, typeFee: typeof fee })

      if (!zone || fee === undefined || fee === null) {
        return response.status(400).json({
          success: false,
          message: 'La zone et le montant sont requis',
        })
      }

      const numericFee = Number(fee)
      if (isNaN(numericFee) || numericFee < 0) {
        return response.status(400).json({
          success: false,
          message: 'Le montant doit être un nombre positif',
        })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.status(403).json({
          success: false,
          message: 'Accès réservé aux marchands',
        })
      }

      let zones: Record<string, number> = {}
      
      if (user.delivery_zones && typeof user.delivery_zones === 'object') {
        zones = { ...user.delivery_zones }
      }

      const normalizedZone = zone.toLowerCase().trim()
      zones[normalizedZone] = numericFee

      try {
        await Database.rawQuery(
          'UPDATE users SET delivery_zones = ? WHERE id = ?',
          [JSON.stringify(zones), user.id]
        )
        console.log('✅ Zone sauvegardée via SQL direct:', { zone: normalizedZone, fee: numericFee })
      } catch (sqlError: any) {
        console.error('❌ Erreur SQL:', sqlError)
        throw sqlError
      }

      return response.json({
        success: true,
        message: `Zone "${zone}" enregistrée avec succès`,
        data: {
          zone: normalizedZone.charAt(0).toUpperCase() + normalizedZone.slice(1),
          fee: numericFee,
          total_zones: Object.keys(zones).length,
        },
      })
    } catch (error: any) {
      console.error('❌ Erreur upsertDeliveryZone:', error)
      return response.status(500).json({
        success: false,
        message: error.message || 'Erreur serveur',
        error: error.message,
      })
    }
  }

  async updateDeliveryZones({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { zones } = request.only(['zones'])

      if (!zones || typeof zones !== 'object') {
        return response.badRequest({
          success: false,
          message: 'Les zones sont requises (format: { "zone": montant })',
        })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const normalizedZones: Record<string, number> = {}
      for (const [zone, fee] of Object.entries(zones)) {
        if (typeof fee === 'number' && fee >= 0) {
          normalizedZones[zone.toLowerCase().trim()] = fee
        }
      }

      user.delivery_zones = normalizedZones
      await user.save()

      return response.ok({
        success: true,
        message: 'Zones de livraison mises à jour avec succès',
        data: {
          zones: Object.entries(normalizedZones).map(([zone, fee]) => ({
            zone: zone.charAt(0).toUpperCase() + zone.slice(1),
            fee,
          })),
          total_zones: Object.keys(normalizedZones).length,
        },
      })
    } catch (error: any) {
      console.error('Erreur updateDeliveryZones:', error)
      return response.internalServerError({
        success: false,
        message: error.message,
      })
    }
  }

  async removeDeliveryZone({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { zone } = request.only(['zone'])

      if (!zone) {
        return response.badRequest({
          success: false,
          message: 'La zone est requise',
        })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Accès réservé aux marchands' })
      }

      const normalizedZone = zone.toLowerCase().trim()
      const zones = user.delivery_zones || {}

      if (!zones[normalizedZone]) {
        return response.notFound({
          success: false,
          message: `La zone "${zone}" n'existe pas`,
        })
      }

      delete zones[normalizedZone]
      user.delivery_zones = zones
      await user.save()

      return response.ok({
        success: true,
        message: `Zone "${zone}" supprimée avec succès`,
        data: {
          total_zones: Object.keys(zones).length,
        },
      })
    } catch (error: any) {
      console.error('Erreur removeDeliveryZone:', error)
      return response.internalServerError({
        success: false,
        message: error.message,
      })
    }
  }

  async calculateDeliveryFee({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { zone } = request.only(['zone'])

      if (!zone) {
        return response.badRequest({
          success: false,
          message: 'La zone est requise',
        })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Marchand non trouvé' })
      }

      const deliveryFee = user.getDeliveryFee(zone)
      const servesZone = user.servesZone(zone)

      return response.ok({
        success: true,
        data: {
          zone: zone,
          delivery_fee: deliveryFee,
          serves_zone: servesZone,
          message: servesZone 
            ? `Frais de livraison pour ${zone}: ${deliveryFee} FCFA`
            : `Le marchand ne dessert pas la zone "${zone}"`,
        },
      })
    } catch (error: any) {
      console.error('Erreur calculateDeliveryFee:', error)
      return response.internalServerError({
        success: false,
        message: error.message,
      })
    }
  }
}
