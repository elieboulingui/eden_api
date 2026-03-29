// app/models/wallet.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'

export default class Wallet extends BaseModel {
  static table = 'wallets'

  @column({ isPrimary: true })
  declare id: string  // ← Changé de number à string

  @column()
  declare user_id: string  // ← Changé de number à string

  @column()
  declare balance: number

  @column()
  declare currency: string

  @column()
  declare status: 'active' | 'blocked' | 'pending'

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(wallet: Wallet) {
    wallet.id = crypto.randomUUID()
  }

  // Méthodes utilitaires
  async addBalance(amount: number): Promise<void> {
    this.balance += amount
    await this.save()
  }

  async subtractBalance(amount: number): Promise<boolean> {
    if (this.balance >= amount) {
      this.balance -= amount
      await this.save()
      return true
    }
    return false
  }

  async hasSufficientBalance(amount: number): Promise<boolean> {
    return this.balance >= amount
  }
}
