// app/models/order_item.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import Order from './Order.js'
import Product from './Product.js'

export default class OrderItem extends BaseModel {
  static table = 'Orderitem'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare order_id: string  // This must match the foreignKey in Order's hasMany relation

  @column()
  declare product_id: number

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
    foreignKey: 'product_id'
  })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static async generateUuid(item: OrderItem) {
    if (!item.id) {
      item.id = uuidv4()
    }
  }
}