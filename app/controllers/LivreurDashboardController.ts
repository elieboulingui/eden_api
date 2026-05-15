// app/controllers/LivreurDashboardController.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Order from '#models/Order'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'

export default class LivreurDashboardController {

  /**
   * Vérifie que l'utilisateur est un livreur (edenlivreur ou livreur)
   */
  private async getLivreur(userId: string, response: HttpContext['response']): Promise<User | null> {
    const user = await User.find(userId)
    
    if (!user) {
      response.status(404).json({ success: false, message: 'Utilisateur introuvable' })
      return null
    }

    if (user.role !== 'livreur' && user.role !== 'edenlivreur') {
      response.status(403).json({ success: false, message: 'Accès réservé aux livreurs' })
      return null
    }

    return user
  }

  /**
   * GET /api/livreur/dashboard/stats
   * Statistiques du livreur
   */
  async stats({ request, response }: HttpContext) {
    const userId = request.qs().userId || request.input('userId')

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    const livreur = await this.getLivreur(userId, response)
    if (!livreur) return

    // Commandes du jour
    const todayStart = DateTime.now().startOf('day').toSQL()
    const todayEnd = DateTime.now().endOf('day').toSQL()

    const completedToday = await Order.query()
      .where('livreur_id', userId)
      .where('status', 'delivered')
      .whereBetween('updated_at', [todayStart!, todayEnd!])
      .count('* as total')

    const pendingDeliveries = await Order.query()
      .where('livreur_id', userId)
      .whereIn('status', ['pending', 'accepted', 'picked_up', 'in_transit'])
      .count('* as total')

    const earningsToday = await Order.query()
      .where('livreur_id', userId)
      .where('status', 'delivered')
      .whereBetween('updated_at', [todayStart!, todayEnd!])
      .sum('shipping_cost as total')

    // Wallet
    const wallet = await Wallet.findBy('user_id', userId)

    return response.json({
      success: true,
      data: {
        total_deliveries: livreur.total_deliveries,
        completed_today: Number(completedToday[0]?.$extras?.total || 0),
        pending_deliveries: Number(pendingDeliveries[0]?.$extras?.total || 0),
        total_earnings: livreur.total_earnings,
        earnings_today: Number(earningsToday[0]?.$extras?.total || 0),
        rating: livreur.rating,
        total_ratings: livreur.total_ratings,
        is_online: livreur.is_online,
        is_available: livreur.is_available,
        vehicle_type: livreur.vehicle_type,
        wallet_balance: wallet?.balance || 0,
      },
    })
  }

  /**
   * GET /api/livreur/dashboard/deliveries
   * Liste des livraisons du livreur
   */
  async deliveries({ request, response }: HttpContext) {
    const userId = request.qs().userId || request.input('userId')
    const status = request.qs().status // optional: pending, active, delivered
    const page = request.qs().page || 1
    const limit = request.qs().limit || 20

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    const livreur = await this.getLivreur(userId, response)
    if (!livreur) return

    let query = Order.query()
      .where('livreur_id', userId)
      .preload('items')
      .orderBy('created_at', 'desc')

    if (status === 'pending') {
      query = query.where('status', 'pending')
    } else if (status === 'active') {
      query = query.whereIn('status', ['accepted', 'picked_up', 'in_transit'])
    } else if (status === 'delivered') {
      query = query.where('status', 'delivered')
    }

    const deliveries = await query.paginate(page, limit)

    return response.json({
      success: true,
      data: deliveries.map(order => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.shipping_address,
        restaurant_name: order.metadata?.restaurant_name || 'Restaurant',
        amount: order.total,
        delivery_fee: order.shipping_cost,
        status: order.status,
        pickup_address: order.metadata?.pickup_address || order.shipping_address,
        distance: order.metadata?.distance || 'N/A',
        estimated_time: order.metadata?.estimated_time || 'N/A',
        created_at: order.created_at,
        updated_at: order.updated_at,
      })),
      meta: deliveries.getMeta(),
    })
  }

  /**
   * GET /api/livreur/dashboard/delivery/:id
   * Détail d'une livraison
   */
  async deliveryDetail({ params, request, response }: HttpContext) {
    const userId = request.qs().userId || request.input('userId')
    const deliveryId = params.id

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    const order = await Order.query()
      .where('id', deliveryId)
      .where('livreur_id', userId)
      .preload('items')
      .first()

    if (!order) {
      return response.status(404).json({ success: false, message: 'Livraison introuvable' })
    }

    return response.json({
      success: true,
      data: {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.shipping_address,
        restaurant_name: order.metadata?.restaurant_name || 'Restaurant',
        amount: order.total,
        delivery_fee: order.shipping_cost,
        status: order.status,
        pickup_address: order.metadata?.pickup_address || order.shipping_address,
        distance: order.metadata?.distance || 'N/A',
        estimated_time: order.metadata?.estimated_time || 'N/A',
        items: order.items.map(item => ({
          id: item.id,
          product_name: item.product_name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
    })
  }

  /**
   * PUT /api/livreur/dashboard/delivery/:id/status
   * Mettre à jour le statut d'une livraison
   */
  async updateDeliveryStatus({ params, request, response }: HttpContext) {
    const { userId, status } = request.only(['userId', 'status'])
    const deliveryId = params.id

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    if (!status) {
      return response.status(400).json({ success: false, message: 'status requis' })
    }

    const validStatuses = ['accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return response.status(400).json({ 
        success: false, 
        message: 'Statut invalide',
        valid_statuses: validStatuses 
      })
    }

    const order = await Order.query()
      .where('id', deliveryId)
      .where('livreur_id', userId)
      .first()

    if (!order) {
      return response.status(404).json({ success: false, message: 'Livraison introuvable' })
    }

    const oldStatus = order.status
    order.status = status
    
    if (status === 'delivered') {
      order.delivered_at = DateTime.now()
      
      // Incrémenter les stats du livreur
      const livreur = await User.find(userId)
      if (livreur) {
        livreur.total_deliveries += 1
        livreur.total_earnings += Number(order.shipping_cost)
        await livreur.save()
      }
    }

    await order.save()

    return response.json({
      success: true,
      message: `Statut mis à jour: ${oldStatus} → ${status}`,
      data: {
        id: order.id,
        order_number: order.order_number,
        old_status: oldStatus,
        new_status: status,
        updated_at: order.updated_at,
      },
    })
  }

  /**
   * PUT /api/livreur/dashboard/online
   * Activer/désactiver le statut en ligne
   */
  async toggleOnline({ request, response }: HttpContext) {
    const { userId, is_online } = request.only(['userId', 'is_online'])

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    const livreur = await this.getLivreur(userId, response)
    if (!livreur) return

    livreur.is_online = is_online === true || is_online === 'true'
    livreur.is_available = livreur.is_online
    await livreur.save()

    return response.json({
      success: true,
      message: livreur.is_online ? '🟢 En ligne' : '🔴 Hors ligne',
      data: {
        is_online: livreur.is_online,
        is_available: livreur.is_available,
      },
    })
  }

  /**
   * PUT /api/livreur/dashboard/location
   * Mettre à jour la position GPS
   */
  async updateLocation({ request, response }: HttpContext) {
    const { userId, latitude, longitude } = request.only(['userId', 'latitude', 'longitude'])

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    if (!latitude || !longitude) {
      return response.status(400).json({ success: false, message: 'latitude et longitude requis' })
    }

    const livreur = await this.getLivreur(userId, response)
    if (!livreur) return

    livreur.current_latitude = latitude
    livreur.current_longitude = longitude
    livreur.last_location_update = DateTime.now()
    await livreur.save()

    return response.json({
      success: true,
      message: 'Position mise à jour',
      data: {
        latitude: livreur.current_latitude,
        longitude: livreur.current_longitude,
        updated_at: livreur.last_location_update,
      },
    })
  }

  /**
   * GET /api/livreur/dashboard/earnings
   * Historique des gains
   */
  async earnings({ request, response }: HttpContext) {
    const userId = request.qs().userId || request.input('userId')
    const period = request.qs().period || 'week' // day, week, month

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    const livreur = await this.getLivreur(userId, response)
    if (!livreur) return

    let startDate: DateTime

    switch (period) {
      case 'day':
        startDate = DateTime.now().startOf('day')
        break
      case 'week':
        startDate = DateTime.now().startOf('week')
        break
      case 'month':
        startDate = DateTime.now().startOf('month')
        break
      default:
        startDate = DateTime.now().startOf('week')
    }

    const deliveries = await Order.query()
      .where('livreur_id', userId)
      .where('status', 'delivered')
      .where('updated_at', '>=', startDate.toSQL()!)
      .orderBy('updated_at', 'desc')

    // Grouper par jour
    const earningsByDay = new Map<string, { date: string; deliveries: number; amount: number; bonus: number; total: number }>()

    for (const order of deliveries) {
      const dateKey = order.updated_at?.toFormat('yyyy-MM-dd') || ''
      
      if (!earningsByDay.has(dateKey)) {
        earningsByDay.set(dateKey, {
          date: dateKey,
          deliveries: 0,
          amount: 0,
          bonus: 0,
          total: 0,
        })
      }

      const dayData = earningsByDay.get(dateKey)!
      dayData.deliveries += 1
      dayData.amount += Number(order.shipping_cost)
      dayData.total += Number(order.shipping_cost)
    }

    const wallet = await Wallet.findBy('user_id', userId)

    return response.json({
      success: true,
      data: {
        total_earnings: livreur.total_earnings,
        wallet_balance: wallet?.balance || 0,
        period,
        history: Array.from(earningsByDay.values()).sort((a, b) => b.date.localeCompare(a.date)),
      },
    })
  }

  /**
   * PUT /api/livreur/dashboard/profile
   * Mettre à jour le profil
   */
  async updateProfile({ request, response }: HttpContext) {
    const { userId, full_name, email, phone, vehicle_type, avatar } = request.only(['userId', 'full_name', 'email', 'phone', 'vehicle_type', 'avatar'])

    if (!userId) {
      return response.status(400).json({ success: false, message: 'userId requis' })
    }

    const livreur = await this.getLivreur(userId, response)
    if (!livreur) return

    if (full_name) livreur.full_name = full_name
    if (email) livreur.email = email
    if (phone) livreur.phone = phone
    if (vehicle_type) livreur.vehicle_type = vehicle_type
    if (avatar) livreur.avatar = avatar

    await livreur.save()

    return response.json({
      success: true,
      message: 'Profil mis à jour',
      data: {
        id: livreur.id,
        full_name: livreur.full_name,
        email: livreur.email,
        phone: livreur.phone,
        vehicle_type: livreur.vehicle_type,
        avatar: livreur.avatar,
        role: livreur.role,
      },
    })
  }
}
