// app/models/WithdrawalHistory.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import Withdrawal from './Withdrawal.js'
import User from './user.js'

export default class WithdrawalHistory extends BaseModel {
  static table = 'withdrawal_histories'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare withdrawal_id: string

  @column()
  declare user_id: string

  @column()
  declare action: string  // 'created', 'processing', 'completed', 'failed', 'cancelled', 'refunded'

  @column()
  declare old_status: string | null

  @column()
  declare new_status: string

  @column()
  declare amount: number | null

  @column()
  declare notes: string | null

  @column()
  declare performed_by: string | null  // user_id ou 'system'

  @column()
  declare ip_address: string | null

  @column()
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @belongsTo(() => Withdrawal, {
    foreignKey: 'withdrawal_id',
  })
  declare withdrawal: BelongsTo<typeof Withdrawal>

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(history: WithdrawalHistory) {
    history.id = crypto.randomUUID()
  }
}