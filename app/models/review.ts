// app/models/review.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from './user.js'
import Product from './Product.js'

export default class Review extends BaseModel {
  static table = 'reviews'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: string

  @column()
  declare product_id: number

  @column()
  declare merchant_id: string | null  // Change to accept null

  @column()
  declare rating: number

  @column()
  declare comment: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static async generateUuid(review: Review) {
    if (!review.id) {
      review.id = uuidv4()
    }
  }
}