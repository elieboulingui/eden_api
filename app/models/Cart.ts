// app/models/Cart.ts
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
import CartItem from './CartItem.js'  // Changé de Cartitem.js à CartItem.js

export default class Cart extends BaseModel {
  static table = 'carts'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @hasMany(() => CartItem, { foreignKey: 'cart_id' })
  declare items: HasMany<typeof CartItem>

  @beforeCreate()
  static async generateUuid(cart: Cart) {
    if (!cart.id) {
      cart.id = randomUUID()
    }
  }
}
