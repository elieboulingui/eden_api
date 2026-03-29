// app/models/order_tracking.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import Order from './order.js'  // ← Lowercase

export default class OrderTracking extends BaseModel {
  static table = 'order_tracking'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare order_id: string

  @column()
  declare status: string

  @column()
  declare description: string | null

  @column()
  declare location: string | null

  @column.dateTime({ autoCreate: true })
  declare tracked_at: DateTime

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Order, {
    foreignKey: 'order_id'
  })
  declare order: BelongsTo<typeof Order>

  @beforeCreate()
  static async generateUuid(tracking: OrderTracking) {
    if (!tracking.id) {
      tracking.id = crypto.randomUUID()
    }
    if (!tracking.tracked_at) {
      tracking.tracked_at = DateTime.now()
    }
  }
}
