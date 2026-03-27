// app/models/transaction.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Wallet from './wallet.js'
import User from './user.js'

export default class Transaction extends BaseModel {
  static table = 'transactions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare wallet_id: string

  @column()
  declare user_id: string

  @column()
  declare type: 'credit' | 'debit' | 'withdrawal' | 'deposit'

  @column()
  declare amount: number

  @column()
  declare balance_before: number

  @column()
  declare balance_after: number

  @column()
  declare reference: string

  @column()
  declare description: string | null

  @column()
  declare status: 'pending' | 'completed' | 'failed'

  @column()
  declare metadata: any

  @column.dateTime()
  declare completed_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => Wallet, {
    foreignKey: 'wallet_id',
  })
  declare wallet: BelongsTo<typeof Wallet>

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>
}
