// app/models/GuestOrder.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
import Order from './Order.js'
import KYC from './kyc.js'

export default class GuestOrder extends BaseModel {
  static table = 'guest_orders'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'guest_id' })
  declare guestId: string

  @column({ columnName: 'customer_name' })
  declare customerName: string

  @column({ columnName: 'customer_email' })
  declare customerEmail: string

  @column({ columnName: 'customer_phone' })
  declare customerPhone: string

  @column({ columnName: 'kyc_id' })
  declare kycId: string | null

  @column({ columnName: 'order_id' })
  declare orderId: string | null

  @column()
  declare status: string

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  // ==================== RELATIONS ====================

  @belongsTo(() => Order, {
    foreignKey: 'order_id'
  })
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => KYC, {
    foreignKey: 'kyc_id'
  })
  declare kyc: BelongsTo<typeof KYC>

  // ==================== HOOKS ====================

  @beforeCreate()
  static async generateUuid(guestOrder: GuestOrder) {
    if (!guestOrder.id) {
      guestOrder.id = randomUUID()
    }
    if (!guestOrder.status) {
      guestOrder.status = 'pending'
    }
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Vérifier si la commande est en attente
   */
  isPending(): boolean {
    return this.status === 'pending'
  }

  /**
   * Vérifier si la commande est payée
   */
  isPaid(): boolean {
    return this.status === 'paid'
  }

  /**
   * Vérifier si la commande est annulée
   */
  isCancelled(): boolean {
    return this.status === 'cancelled'
  }

  /**
   * Obtenir le libellé du statut
   */
  getStatusLabel(): string {
    const labels: Record<string, string> = {
      pending: 'En attente',
      paid: 'Payée',
      cancelled: 'Annulée',
      expired: 'Expirée'
    }
    return labels[this.status] || this.status
  }

  /**
   * Obtenir le nom complet du client
   */
  getFullName(): string {
    return this.customerName || 'Client'
  }

  /**
   * Obtenir l'email du client
   */
  getEmail(): string {
    return this.customerEmail || 'non-renseigné@email.com'
  }

  /**
   * Obtenir le téléphone du client
   */
  getPhone(): string {
    return this.customerPhone || 'Non renseigné'
  }
}
