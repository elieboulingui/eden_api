// app/models/favorite.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Product from './product.js'  // ← Lowercase

export default class Favorite extends BaseModel {
  static table = 'favorites'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string

  @column()
  declare product_id: string  // ← Changé de number à string pour UUID

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Product, {
    foreignKey: 'product_id'
  })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static async generateUuid(favorite: Favorite) {
    if (!favorite.id) {
      favorite.id = crypto.randomUUID()
    }
  }
}
