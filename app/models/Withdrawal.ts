// app/models/Withdrawal.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Wallet from './wallet.js'

export default class Withdrawal extends BaseModel {
  static table = 'withdrawals'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string

  @column()
  declare wallet_id: string

  @column()
  declare amount: number

  @column()
  declare fee: number

  @column()
  declare net_amount: number

  @column()
  declare currency: string

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

  @column()
  declare payment_method: string  // Dynamique : airtel_money, moov_money, orange_money, virement_bancaire, etc.

  @column()
  declare operator: string | null  // Dynamique : airtel, moov, orange, bank, etc.

  @column()
  declare account_number: string

  @column()
  declare account_name: string

  @column()
  declare bank_name: string | null

  @column()
  declare reference: string

  @column()
  declare transaction_id: string | null

  @column()
  declare external_reference: string | null

  @column()
  declare notes: string | null

  @column()
  declare failure_reason: string | null

  @column()
  declare ip_address: string | null

  @column()
  declare user_agent: string | null

  @column()
  declare metadata: Record<string, any> | null

  @column()
  declare processed_by: string | null

  @column.dateTime({ columnName: 'processed_at' })
  declare processed_at: DateTime | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Wallet, {
    foreignKey: 'wallet_id',
  })
  declare wallet: BelongsTo<typeof Wallet>

  @beforeCreate()
  static assignUuid(withdrawal: Withdrawal) {
    withdrawal.id = crypto.randomUUID()
  }

  @beforeCreate()
  static async setDefaults(withdrawal: Withdrawal) {
    // Générer une référence unique
    withdrawal.reference = `WTH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`
    withdrawal.currency = withdrawal.currency ?? 'XOF'
    withdrawal.fee = withdrawal.fee ?? 0
    withdrawal.net_amount = withdrawal.net_amount ?? withdrawal.amount - withdrawal.fee
    withdrawal.status = withdrawal.status ?? 'pending'
  }

  // Méthodes utilitaires
  get isPending(): boolean {
    return this.status === 'pending'
  }

  get isProcessing(): boolean {
    return this.status === 'processing'
  }

  get isCompleted(): boolean {
    return this.status === 'completed'
  }

  get isFailed(): boolean {
    return this.status === 'failed'
  }

  get isCancelled(): boolean {
    return this.status === 'cancelled'
  }

  get statusLabel(): string {
    const labels: Record<string, string> = {
      'pending': 'En attente',
      'processing': 'En cours',
      'completed': 'Terminé',
      'failed': 'Échoué',
      'cancelled': 'Annulé',
    }
    return labels[this.status] || this.status
  }

  get statusColor(): string {
    const colors: Record<string, string> = {
      'pending': 'amber',
      'processing': 'blue',
      'completed': 'green',
      'failed': 'red',
      'cancelled': 'gray',
    }
    return colors[this.status] || 'gray'
  }

  async markAsProcessing(): Promise<void> {
    this.status = 'processing'
    await this.save()
  }

  async markAsCompleted(transactionId?: string): Promise<void> {
    this.status = 'completed'
    this.processed_at = DateTime.now()
    if (transactionId) {
      this.transaction_id = transactionId
    }
    await this.save()
  }

  async markAsFailed(reason: string): Promise<void> {
    this.status = 'failed'
    this.failure_reason = reason
    this.processed_at = DateTime.now()
    await this.save()
  }

  async markAsCancelled(reason?: string): Promise<void> {
    this.status = 'cancelled'
    if (reason) {
      this.failure_reason = reason
    }
    await this.save()
  }
}