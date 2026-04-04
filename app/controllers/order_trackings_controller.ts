// app/controllers/order_trackings_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderTracking from '#models/order_tracking'
import { DateTime } from 'luxon'

export default class OrderTrackingController {
  /**
   * Rechercher une commande par numéro et email
   * POST /api/tracking/search
   */
  async search({ request, response }: HttpContext) {
    try {
      const { orderNumber, email } = request.only(['orderNumber', 'email'])

      if (!orderNumber) {
        return response.status(400).json({
          success: false,
          message: 'Le numéro de commande est requis'
        })
      }

      // Rechercher la commande par numéro
      const order = await Order.query()
        .where('order_number', orderNumber)
        .preload('items')
        .first()

      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      // Si email est fourni, vérifier qu'il correspond
      if (email && order.customer_email !== email) {
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      // Récupérer les événements de suivi
      const trackingEvents = await OrderTracking.query()
        .where('order_id', order.id)
        .orderBy('tracked_at', 'asc')

      // Formater la réponse
      const orderData = {
        id: order.id,
        number: order.order_number,
        date: order.created_at,
        status: this.getStatusLabel(order.status),
        statusCode: order.status,
        items: order.items.map((item: any) => ({
          id: item.id,
          name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        })),
        shipping: {
          method: 'Livraison standard',
          address: order.shipping_address,
          estimatedDelivery: order.estimated_delivery,
          trackingEvents: trackingEvents.map(event => ({
            date: event.tracked_at,
            status: event.description || this.getStatusLabel(event.status),
            statusCode: event.status,
            location: event.location
          }))
        },
        payment: {
          method: order.payment_method,
          subtotal: order.total - (order.shipping_cost || 0),
          shipping: order.shipping_cost || 0,
          total: order.total
        }
      }

      // Si pas d'événements de suivi, en générer par défaut
      if (trackingEvents.length === 0) {
        orderData.shipping.trackingEvents = this.generateDefaultTrackingEvents(order.status, order.created_at)
      }

      return response.status(200).json({
        success: true,
        data: orderData
      })
    } catch (error: any) {
      console.error('Erreur recherche commande:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche de la commande',
        error: error.message
      })
    }
  }

  /**
   * Ajouter un événement de suivi pour une commande (admin)
   * POST /api/tracking/:orderId/event
   */
  async addTrackingEvent({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { status, location, description } = request.only(['status', 'location', 'description'])

      const order = await Order.find(orderId)

      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      // Créer l'événement de suivi
      const tracking = await OrderTracking.create({
        order_id: order.id,
        status,
        location,
        description,
        tracked_at: DateTime.now()
      })

      // Mettre à jour le statut de la commande si nécessaire
      if (status === 'shipped' || status === 'delivered' || status === 'cancelled') {
        order.status = status
        if (status === 'delivered') {
          order.delivered_at = DateTime.now()
        }
        await order.save()
      }

      return response.status(201).json({
        success: true,
        message: 'Événement de suivi ajouté',
        data: tracking
      })
    } catch (error: any) {
      console.error('Erreur ajout événement:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout de l\'événement',
        error: error.message
      })
    }
  }

  /**
   * Récupérer tous les événements de suivi d'une commande
   * GET /api/tracking/:orderId/events
   */
  async getTrackingEvents({ params, response }: HttpContext) {
    try {
      const { orderId } = params

      const events = await OrderTracking.query()
        .where('order_id', orderId)
        .orderBy('tracked_at', 'asc')

      return response.status(200).json({
        success: true,
        data: events
      })
    } catch (error: any) {
      console.error('Erreur récupération événements:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des événements',
        error: error.message
      })
    }
  }

  /**
   * Mettre à jour le statut d'une commande
   * PUT /api/tracking/:orderId/status
   */
  async updateOrderStatus({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { status, location, description } = request.only(['status', 'location', 'description'])

      const order = await Order.find(orderId)

      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      // Ajouter un événement de suivi
      await OrderTracking.create({
        order_id: order.id,
        status,
        location,
        description,
        tracked_at: DateTime.now()
      })

      // Mettre à jour le statut de la commande
      order.status = status
      if (status === 'delivered') {
        order.delivered_at = DateTime.now()
      }
      await order.save()

      return response.status(200).json({
        success: true,
        message: 'Statut de la commande mis à jour',
        data: order
      })
    } catch (error: any) {
      console.error('Erreur mise à jour statut:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut',
        error: error.message
      })
    }
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'En attente de confirmation',
      processing: 'En cours de préparation',
      shipped: 'Expédiée',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    }
    return labels[status] || status
  }

  private generateDefaultTrackingEvents(status: string, createdAt: any): any[] {
    const events = []
    const baseDate = new Date(createdAt)

    events.push({
      date: baseDate,
      status: 'Commande confirmée',
      statusCode: 'confirmed'
    })

    events.push({
      date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
      status: 'En cours de préparation',
      statusCode: 'processing'
    })

    if (status === 'processing' || status === 'shipped' || status === 'delivered') {
      events.push({
        date: new Date(baseDate.getTime() + 48 * 60 * 60 * 1000),
        status: 'Expédiée',
        statusCode: 'shipped'
      })
    }

    if (status === 'delivered') {
      events.push({
        date: new Date(baseDate.getTime() + 72 * 60 * 60 * 1000),
        status: 'Livrée',
        statusCode: 'delivered'
      })
    }

    return events
  }
}