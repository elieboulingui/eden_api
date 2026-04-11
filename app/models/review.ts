import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { randomUUID } from 'node:crypto'
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
  declare merchant_id: string | null

  @column()
  declare rating: number

  @column()
  declare title: string | null

  @column()
  declare comment: string | null

  @column()
  declare status: string

  @column()
  declare is_verified_purchase: boolean

  @column()
  declare helpful_count: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Product, {
    foreignKey: 'product_id',
  })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static async generateUuid(review: Review) {
    if (!review.id) {
      review.id = randomUUID()
    }
    review.status = review.status ?? 'pending'
    review.helpful_count = review.helpful_count ?? 0
    review.is_verified_purchase = review.is_verified_purchase ?? false
  }
}
