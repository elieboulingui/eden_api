import { BaseModel, column, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import CartItem from './CartItem.ts'
import { v4 as uuidv4 } from 'uuid'

export default class Cart extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  @column()
  public user_id: string

  @hasMany(() => CartItem, { foreignKey: 'cart_id' })
  public items: HasMany<typeof CartItem>

  @beforeCreate()
  public static assignUuid(cart: Cart) {
    cart.id = uuidv4()
  }
}
