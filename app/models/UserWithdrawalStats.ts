// app/models/UserWithdrawalStats.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'

export default class UserWithdrawalStats extends BaseModel {
  static table = 'user_withdrawal_stats'

  @column({ isPrimary: true })
  declare id: string  // ← Changé de number à string

  @column()
  declare user_id: string

  @column()
  declare total_withdrawals: number

  @column()
  declare total_amount: number

  @column()
  declare completed_count: number

  @column()
  declare completed_amount: number

  @column()
  declare pending_count: number

  @column()
  declare pending_amount: number

  @column()
  declare failed_count: number

  @column()
  declare failed_amount: number

  @column()
  declare last_withdrawal_at: DateTime | null

  @column()
  declare last_withdrawal_amount: number | null

  @column()
  declare largest_withdrawal: number

  @column()
  declare average_withdrawal: number

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updated_at: DateTime

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(stats: UserWithdrawalStats) {
    stats.id = crypto.randomUUID()
  }
}