// app/models/Refund.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
import Order from './Order.js'
import User from './user.js'

export type RefundStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'completed'
export type RefundMethod = 'original_payment' | 'wallet_credit' | 'bank_transfer' | 'mobile_money'
export type RefundReasonType = 
  | 'product_unavailable' 
  | 'shipping_delay' 
  | 'defective_product' 
  | 'wrong_product' 
  | 'customer_cancellation'
  | 'duplicate_order'
  | 'fraudulent_transaction'
  | 'other'

export default class Refund extends BaseModel {
  static table = 'refunds'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare order_id: string

  @column()
  declare user_id: string | null

  @column()
  declare admin_id: string | null

  @column()
  declare amount: number

  @column()
  declare currency: string

  @column()
  declare status: RefundStatus

  @column()
  declare method: RefundMethod

  @column()
  declare transaction_reference: string | null

  @column()
  declare external_transaction_id: string | null

  @column()
  declare reason: string

  @column()
  declare reason_type: RefundReasonType | null

  @column()
  declare admin_notes: string | null

  @column()
  declare customer_notes: string | null

  @column()
  declare refunded_items: any | null

  @column.dateTime()
  declare requested_at: DateTime

  @column.dateTime()
  declare processed_at: DateTime | null

  @column.dateTime()
  declare completed_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Order, {
    foreignKey: 'order_id'
  })
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => User, {
    foreignKey: 'user_id'
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'admin_id'
  })
  declare admin: BelongsTo<typeof User>

  @beforeCreate()
  static async generateUuid(refund: Refund) {
    if (!refund.id) {
      refund.id = randomUUID()
    }
    if (!refund.requested_at) {
      refund.requested_at = DateTime.now()
    }
    if (!refund.currency) {
      refund.currency = 'XAF'
    }
    if (!refund.status) {
      refund.status = 'pending'
    }
    if (!refund.method) {
      refund.method = 'original_payment'
    }
  }

  // ========== GETTERS ==========
  
  getStatusLabel(): string {
    const labels: Record<RefundStatus, string> = {
      pending: 'En attente',
      processing: 'En traitement',
      approved: 'Approuvé',
      rejected: 'Rejeté',
      completed: 'Terminé'
    }
    return labels[this.status] || this.status
  }

  getStatusBadgeClass(): string {
    const classes: Record<RefundStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-800'
    }
    return classes[this.status] || 'bg-gray-100 text-gray-800'
  }

  getStatusColor(): string {
    const colors: Record<RefundStatus, string> = {
      pending: '#eab308',
      processing: '#3b82f6',
      approved: '#16a34a',
      rejected: '#dc2626',
      completed: '#6b7280'
    }
    return colors[this.status] || '#6b7280'
  }

  getFormattedAmount(): string {
    return `${this.amount.toLocaleString('fr-FR')} ${this.currency}`
  }

  // ========== MÉTHODES ==========

  async approve(adminId: string, adminNotes?: string): Promise<void> {
    this.status = 'approved'
    this.admin_id = adminId
    if (adminNotes) {
      this.admin_notes = adminNotes
    }
    this.processed_at = DateTime.now()
    await this.save()
  }

  async reject(adminId: string, reason: string): Promise<void> {
    this.status = 'rejected'
    this.admin_id = adminId
    this.admin_notes = reason
    this.processed_at = DateTime.now()
    await this.save()
  }

  async complete(externalTransactionId?: string): Promise<void> {
    this.status = 'completed'
    if (externalTransactionId) {
      this.external_transaction_id = externalTransactionId
    }
    this.completed_at = DateTime.now()
    await this.save()
  }

  async process(): Promise<void> {
    this.status = 'processing'
    this.processed_at = DateTime.now()
    await this.save()
  }

  canBeCancelled(): boolean {
    return ['pending', 'processing'].includes(this.status)
  }

  canBeApproved(): boolean {
    return ['pending', 'processing'].includes(this.status)
  }

  canBeRejected(): boolean {
    return ['pending', 'processing'].includes(this.status)
  }
}