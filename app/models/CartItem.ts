// app/models/CartItem.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
import Cart from './Cart.js'
import Product from './Product.js'

export default class CartItem extends BaseModel {
  public static table = 'cart_items'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare cart_id: string

  @column()
  declare product_id: string // ✅ UUID aussi

  @column()
  declare quantity: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Cart, {
    foreignKey: 'cart_id',
  })
  declare cart: BelongsTo<typeof Cart>

  @belongsTo(() => Product, {
    foreignKey: 'product_id',
  })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static generateUuid(item: CartItem) {
    if (!item.id) {
      item.id = randomUUID()
    }
  }
}
