// app/models/Service.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import DailySubscription from '#models/DailySubscription'

export default class Service extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare merchant_id: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare price: number

  @column()
  declare currency: string

  @column()
  declare category: string | null

  @column()
  declare is_active: boolean

  @column()
  declare subscription_type: string

  @column()
  declare duration_days: number | null

  @column()
  declare trial_days: number

  @column()
  declare has_trial: boolean

  @column()
  declare max_subscribers: number | null

  @column()
  declare is_unlimited: boolean

  @column()
  declare max_uses_per_day: number | null

  @column()
  declare image_url: string | null

  @column()
  declare cover_image_url: string | null

  @column()
  declare features: string | null

  @column()
  declare settings: string | null

  @column()
  declare total_subscribers: number

  @column()
  declare total_revenue: number

  @column()
  declare average_rating: number

  @column()
  declare total_reviews: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, {
    foreignKey: 'merchant_id',
  })
  declare merchant: BelongsTo<typeof User>

  @hasMany(() => DailySubscription, {
    foreignKey: 'service_id',
  })
  declare subscriptions: HasMany<typeof DailySubscription>
}
