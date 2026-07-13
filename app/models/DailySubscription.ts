// app/models/DailySubscription.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/Service'

export default class DailySubscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare client_id: string

  @column()
  declare service_id: string

  @column()
  declare merchant_id: string

  @column()
  declare subscription_date: DateTime

  @column()
  declare valid_until: DateTime

  @column()
  declare price_paid: number

  @column()
  declare currency: string

  @column()
  declare status: string

  @column()
  declare auto_renew: boolean

  @column()
  declare payment_method: string

  @column()
  declare payment_reference: string | null

  @column()
  declare subscription_type: string

  @column.dateTime()
  declare cancelled_at: DateTime | null

  @column()
  declare cancellation_reason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, {
    foreignKey: 'client_id',
  })
  declare client: BelongsTo<typeof User>

  @belongsTo(() => Service, {
    foreignKey: 'service_id',
  })
  declare service: BelongsTo<typeof Service>

  // Computed properties
  get daysRemaining(): number {
    if (!this.valid_until) return 0
    const now = DateTime.now()
    const diff = this.valid_until.diff(now, 'days')
    return Math.max(0, Math.floor(diff.days))
  }

  get hoursRemaining(): number {
    if (!this.valid_until) return 0
    const now = DateTime.now()
    const diff = this.valid_until.diff(now, 'hours')
    return Math.max(0, Math.floor(diff.hours))
  }

  get isActive(): boolean {
    return this.status === 'active' && this.daysRemaining > 0
  }

  get isExpired(): boolean {
    return this.status === 'expired' || (this.status === 'active' && this.daysRemaining === 0)
  }
}
