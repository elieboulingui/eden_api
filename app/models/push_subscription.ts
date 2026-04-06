// app/models/push_subscription.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import crypto from 'node:crypto'

export default class PushSubscription extends BaseModel {
  static table = 'push_subscriptions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare endpoint: string

  @column()
  declare p256dh: string

  @column()
  declare auth: string

  @column()
  declare device_id: string | null

  @column()
  declare device_name: string | null

  @column()
  declare browser: string | null

  @column()
  declare os: string | null

  @column()
  declare sw_version: string | null

  @column()
  declare is_active: boolean

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @beforeCreate()
  static assignUuid(subscription: PushSubscription) {
    if (!subscription.id) {
      subscription.id = crypto.randomUUID()
    }
  }
}
