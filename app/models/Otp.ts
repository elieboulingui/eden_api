// app/models/Otp.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import { randomUUID } from 'node:crypto'

export default class Otp extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string | null

  @column()
  declare email: string

  @column()
  declare otp: string

  @column()
  declare purpose: string

  @column()
  declare isUsed: boolean

  @column()
  declare attempts: number

  // ✅ Nouvelles colonnes pour le blocage
  @column()
  declare isBlocked: boolean

  @column.dateTime()
  declare blockedAt: DateTime | null

  @column()
  declare blockReason: string | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(otp: Otp) {
    otp.id = randomUUID()
    otp.isBlocked = otp.isBlocked || false
  }

  public isValid(): boolean {
    return !this.isUsed &&
      !this.isBlocked &&
      this.expiresAt > DateTime.now() &&
      this.attempts < 5
  }

  public isExpired(): boolean {
    return this.expiresAt <= DateTime.now()
  }

  public async markAsUsed() {
    this.isUsed = true
    await this.save()
  }

  public async incrementAttempts() {
    this.attempts += 1
    await this.save()
  }
}
