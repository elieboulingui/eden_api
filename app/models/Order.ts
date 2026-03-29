import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import OrderItem from './OrderItem.js'

export default class Order extends BaseModel {
  static table = 'orders'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string

  @column()
  declare order_number: string

  @column()
  declare status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

  @column()
  declare total: number

  @column()
  declare subtotal: number

  @column()
  declare shipping_cost: number

  @column()
  declare delivery_method: string

  @column()
  declare customer_name: string

  @column()
  declare customer_email: string

  @column()
  declare customer_phone: string | null

  @column()
  declare shipping_address: string

  @column()
  declare billing_address: string | null

  @column()
  declare payment_method: string

  @column()
  declare tracking_number: string | null

  @column.dateTime()
  declare estimated_delivery: DateTime | null

  @column.dateTime()
  declare delivered_at: DateTime | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => User, {
    foreignKey: 'user_id'
  })
  declare user: BelongsTo<typeof User>

  @hasMany(() => OrderItem, {
    foreignKey: 'order_id'
  })
  declare items: HasMany<typeof OrderItem>

  @beforeCreate()
  static async generateUuid(order: Order) {
    if (!order.id) {
      order.id = uuidv4()
    }
    if (!order.order_number) {
      order.order_number = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    }
  }
}
