import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import Product from './Product.js'

export default class Favorite extends BaseModel {
  static table = 'favorites'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string  // Changed from userId to snake_case

  @column()
  declare product_id: number  // Changed from productId to snake_case

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime  // Changed from createdAt to snake_case

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime  // Changed from updatedAt to snake_case

  @belongsTo(() => User, {
    foreignKey: 'user_id',  // Changed to snake_case
    localKey: 'id'  // User uses 'id' as primary key, not 'uuid'
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Product, {
    foreignKey: 'product_id'  // Changed to snake_case
  })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static async generateUuid(favorite: Favorite) {
    if (!favorite.id) {
      favorite.id = uuidv4()
    }
  }
}