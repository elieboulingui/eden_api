// app/models/OrderItem.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import Order from './order.js'  // ← Lowercase
import Product from './product.js'  // ← Lowercase

export default class OrderItem extends BaseModel {
  static table = 'order_items'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare order_id: string

  @column()
  declare product_id: string  // ← Changé de product_uuid à product_id

  @column()
  declare product_name: string

  @column()
  declare product_description: string | null

  @column()
  declare price: number

  @column()
  declare quantity: number

  @column()
  declare category: string | null

  @column()
  declare image: string | null

  @column()
  declare subtotal: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Order, {
    foreignKey: 'order_id'
  })
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => Product, {
    foreignKey: 'product_id'  // ← Changé de product_uuid à product_id
  })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static async generateUuid(item: OrderItem) {
    if (!item.id) {
      item.id = crypto.randomUUID()
    }
    if (!item.subtotal && item.price && item.quantity) {
      item.subtotal = item.price * item.quantity
    }
  }
}
