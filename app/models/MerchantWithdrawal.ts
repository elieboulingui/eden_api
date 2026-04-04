// app/models/MerchantWithdrawal.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'

export default class MerchantWithdrawal extends BaseModel {
  static table = 'merchant_withdrawals'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string

  @column()
  declare amount: number

  @column()
  declare status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

  @column()
  declare payment_method: string // 'airtel', 'moov', 'bank_transfer'

  @column()
  declare account_number: string

  @column()
  declare account_name: string

  @column()
  declare operator: string | null

  @column()
  declare reference: string

  @column()
  declare transaction_id: string | null

  @column()
  declare notes: string | null

  @column()
  declare processed_by: string | null

  @column.dateTime()
  declare processed_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(withdrawal: MerchantWithdrawal) {
    withdrawal.id = crypto.randomUUID()
    if (!withdrawal.reference) {
      withdrawal.reference = `WDL-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    }
  }
}