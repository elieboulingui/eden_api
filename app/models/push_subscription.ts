import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import crypto from 'node:crypto'

export default class PushSubscription extends BaseModel {
  public static table = 'push_subscriptions'

  @column({ isPrimary: true })
  public id: string

  @column()
  public endpoint: string

  @column()
  public p256dh: string

  @column()
  public auth: string

  @column()
  public device_id: string | null

  @column()
  public device_name: string | null

  @column()
  public browser: string | null

  @column()
  public os: string | null

  @column()
  public sw_version: string | null

  @column()
  public is_active: boolean

  @column.dateTime({ autoCreate: true })
  public created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updated_at: DateTime

  @beforeCreate()
  public static assignUuid(subscription: PushSubscription) {
    if (!subscription.id) {
      subscription.id = crypto.randomUUID()
    }
  }
}
