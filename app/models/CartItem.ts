import Cart from './Cart.ts'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class CartItem extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  @column()
  public cart_id: string

  @column()
  public product_id: number

  @column()
  public quantity: number

  // Relation avec Cart
  @belongsTo(() => Cart, { foreignKey: 'cart_id' })
  public cart: BelongsTo<typeof Cart>

  // Relation avec Product - AJOUTER CETTE RELATION
  @belongsTo(() => Product, { foreignKey: 'product_id' })
  public product: BelongsTo<typeof Product>

  @beforeCreate()
  public static assignUuid(item: CartItem) {
    if (!item.id) {
      item.id = uuidv4()
    }
  }
}