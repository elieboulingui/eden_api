import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import Order from './Order.js'

export default class OrderTracking extends BaseModel {
  static table = 'order_trackings'

  @column({ isPrimary: true })
  declare id: string  // Changed to string for UUID consistency

  @column()
  declare order_id: string  // Changed from orderId to snake_case

  @column()
  declare status: string

  @column()
  declare location: string | null

  @column()
  declare description: string | null

  @column.dateTime()
  declare tracked_at: DateTime  // Changed from trackedAt to snake_case

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime  // Changed from createdAt to snake_case

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime  // Changed from updatedAt to snake_case

  @belongsTo(() => Order, {
    foreignKey: 'order_id'  // Changed to snake_case
  })
  declare order: BelongsTo<typeof Order>

  @beforeCreate()
  static async generateUuid(tracking: OrderTracking) {
    if (!tracking.id) {
      tracking.id = uuidv4()
    }
  }
}