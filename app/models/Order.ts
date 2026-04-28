// app/models/Order.ts
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
import User from './user.js'
import OrderItem from './OrderItem.js'
import Refund from './Refund.js'
import OrderTracking from './order_tracking.js'
import GuestOrder from './GuestOrder.js'

export default class Order extends BaseModel {
  static table = 'orders'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string | null

  // ✅ NOUVEAU : Colonne pour les commandes invité
  @column({ columnName: 'guest_order_id' })
  declare guestOrderId: string | null

  @column()
  declare order_number: string

  @column()
  declare status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending_payment' | 'paid' | 'payment_failed'

  @column()
  declare total: number

  @column()
  declare subtotal: number

  @column()
  declare shipping_cost: number

  @column()
  declare delivery_method: string

  @column()
  declare customer_name: string

  @column()
  declare customer_email: string

  @column()
  declare customer_phone: string | null

  @column()
  declare shipping_address: string

  @column()
  declare billing_address: string | null

  @column()
  declare payment_method: string

  @column()
  declare tracking_number: string | null

  @column.dateTime()
  declare estimated_delivery: DateTime | null

  @column.dateTime()
  declare delivered_at: DateTime | null

  @column()
  declare notes: string | null

  // ✅ CHAMPS POUR LE PAIEMENT MYPVIT
  @column()
  declare payment_transaction_id: string | null

  @column()
  declare payment_reference_id: string | null

  @column()
  declare payment_merchant_account_code: string | null

  @column()
  declare payment_operator_code: string | null

  @column()
  declare payment_operator_simple: string | null

  @column()
  declare payment_status: string | null

  @column()
  declare payment_x_secret: string | null

  @column()
  declare payment_x_secret_expires_in: number | null

  @column()
  declare payment_check_status_url: string | null

  @column()
  declare payment_amount: number | null

  @column()
  declare payment_currency: string | null

  @column()
  declare payment_raw_response: any | null

  @column()
  declare payment_initiated_at: DateTime | null

  @column()
  declare payment_completed_at: DateTime | null

  @column()
  declare payment_error_message: string | null

  @column()
  declare payment_retry_count: number | null

  // ✅ CHAMPS POUR LE SUIVI LIVRAISON
  @column()
  declare shipping_carrier: string | null

  @column()
  declare shipping_tracking_url: string | null

  @column()
  declare shipping_estimated_days: number | null

  @column()
  declare shipping_confirmed_at: DateTime | null

  // ✅ CHAMPS POUR LE RETRAIT EN MAGASIN
  @column()
  declare pickup_store_name: string | null

  @column()
  declare pickup_store_address: string | null

  @column()
  declare pickup_store_phone: string | null

  @column()
  declare pickup_code: string | null

  @column()
  declare picked_up_at: DateTime | null

  // ✅ CHAMPS ADMINISTRATIFS
  @column()
  declare admin_notes: string | null

  @column()
  declare discount_code: string | null

  @column()
  declare discount_amount: number | null

  @column()
  declare coupon_id: string | null

  @column()
  declare ip_address: string | null

  @column()
  declare user_agent: string | null

  // ✅ CHAMPS MANQUANTS POUR LE DASHBOARD
  @column()
  declare tax_amount: number

  @column()
  declare refund_status: 'none' | 'pending' | 'approved' | 'completed' | 'rejected' | null

  @column()
  declare refund_amount: number | null

  @column()
  declare refund_reason: string | null

  @column.dateTime()
  declare refund_requested_at: DateTime | null

  @column.dateTime()
  declare refund_approved_at: DateTime | null

  @column.dateTime()
  declare refund_completed_at: DateTime | null

  @column()
  declare refund_rejection_reason: string | null

  @column.dateTime()
  declare actual_delivery: DateTime | null

  @column()
  declare paypal_order_id: string | null

  @column()
  declare status_history: any // ou JSON

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // ==================== RELATIONS ====================

  // Relation vers l'utilisateur (peut être null pour les invités)
  @belongsTo(() => User, {
    foreignKey: 'user_id'
  })
  declare user: BelongsTo<typeof User>

  // ✅ NOUVEAU : Relation vers la commande invité
  @belongsTo(() => GuestOrder, {
    foreignKey: 'guest_order_id'
  })
  declare guestOrder: BelongsTo<typeof GuestOrder>

  @hasMany(() => OrderItem, {
    foreignKey: 'order_id'
  })
  declare items: HasMany<typeof OrderItem>

  @hasMany(() => OrderTracking, {
    foreignKey: 'order_id'
  })
  declare tracking: HasMany<typeof OrderTracking>

  // ✅ CORRECTION : Relation Refund correctement placée dans la section relations
  @hasMany(() => Refund, {
    foreignKey: 'order_id'
  })
  declare refunds: HasMany<typeof Refund>

  // ==================== HOOKS ====================

  @beforeCreate()
  static async generateUuid(order: Order) {
    if (!order.id) {
      order.id = randomUUID()
    }
    if (!order.order_number) {
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8).toUpperCase()
      order.order_number = `ORD-${timestamp}-${random}`
    }
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Vérifier si la commande a été passée par un invité
   */
  isGuestOrder(): boolean {
    return this.user_id === null && this.guestOrderId !== null
  }

  /**
   * Vérifier si la commande est payée
   */
  isPaid(): boolean {
    return this.payment_status === 'SUCCESS' || this.status === 'paid'
  }

  /**
   * Vérifier si la commande est en attente
   */
  isPending(): boolean {
    return this.status === 'pending' || this.status === 'pending_payment'
  }

  /**
   * Vérifier si la commande est livrée
   */
  isDelivered(): boolean {
    return this.status === 'delivered'
  }

  /**
   * Vérifier si la commande est annulée
   */
  isCancelled(): boolean {
    return this.status === 'cancelled'
  }

  /**
   * Vérifier si la commande peut être annulée
   */
  canBeCancelled(): boolean {
    return ['pending', 'pending_payment', 'paid'].includes(this.status)
  }

  /**
   * Obtenir le total formaté
   */
  getFormattedTotal(): string {
    return `${this.total.toLocaleString()} FCFA`
  }

  /**
   * Obtenir le sous-total formaté
   */
  getFormattedSubtotal(): string {
    return `${this.subtotal.toLocaleString()} FCFA`
  }

  /**
   * Obtenir les frais de livraison formatés
   */
  getFormattedShippingCost(): string {
    return this.shipping_cost === 0 ? 'Gratuit' : `${this.shipping_cost.toLocaleString()} FCFA`
  }

  /**
   * Obtenir le libellé de la méthode de paiement
   */
  getPaymentMethodLabel(): string {
    const methods: Record<string, string> = {
      airtel: 'Airtel Money',
      moov: 'Moov Money',
      gimac: 'GIMAC',
      libertis: 'Libertis',
      card: 'Carte bancaire',
      qr: 'QR Code',
      'QR Code': 'QR Code'
    }
    return methods[this.payment_method] || this.payment_method || 'Non renseigné'
  }

  /**
   * Obtenir le libellé de la méthode de livraison
   */
  getDeliveryMethodLabel(): string {
    const methods: Record<string, string> = {
      pickup: 'Retrait en magasin',
      standard: 'Livraison standard',
      express: 'Livraison express'
    }
    return methods[this.delivery_method] || this.delivery_method || 'Standard'
  }

  /**
   * Obtenir le libellé du statut
   */
  getStatusLabel(): string {
    const labels: Record<string, string> = {
      pending: 'En attente',
      pending_payment: 'Paiement en attente',
      paid: 'Payée',
      processing: 'En traitement',
      shipped: 'Expédiée',
      delivered: 'Livrée',
      cancelled: 'Annulée',
      payment_failed: 'Paiement échoué'
    }
    return labels[this.status] || this.status
  }

  /**
   * Obtenir le type de client (connecté ou invité)
   */
  getCustomerType(): string {
    return this.isGuestOrder() ? 'Invité' : 'Client connecté'
  }

  /**
   * Obtenir le nom du client (priorité au customer_name)
   */
  getCustomerName(): string {
    return this.customer_name || 'Client'
  }

  /**
   * Obtenir l'email du client
   */
  getCustomerEmail(): string {
    return this.customer_email || 'non-renseigné@email.com'
  }

  /**
   * Obtenir le téléphone du client
   */
  getCustomerPhone(): string {
    return this.customer_phone || 'Non renseigné'
  }

  /**
   * Vérifier si la commande est éligible pour un remboursement
   */
  isRefundable(): boolean {
    return this.isPaid() && !this.isDelivered() && !this.isCancelled()
  }
}
