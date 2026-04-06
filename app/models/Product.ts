// app/models/Product.ts

import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'

import User from './user.js'
import Review from './review.js'
import Category from './categories.js'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare price: number

  @column()
  declare description: string

  @column()
  declare stock: number

  @column()
  declare rating: number

  @column({ columnName: 'reviews_count' })
  declare reviewsCount: number

  @column()
  declare userId: string

  @column({ columnName: 'category_id' })
  declare categoryId: string | null

  @column({ columnName: 'image_url' })
  declare imageUrl: string | null

  @column()
  declare origin: string | null

  @column()
  declare weight: string | null

  @column()
  declare packaging: string | null

  @column()
  declare conservation: string | null

  @column()
  declare isNew: boolean

  @column()
  declare isOnSale: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeCreate()
  static assignUuid(product: Product) {
    if (!product.id) {
      product.id = crypto.randomUUID()
    }
  }

  // 🔗 RELATIONS

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @hasMany(() => Review, {
    foreignKey: 'product_id',
  })
  declare reviews: HasMany<typeof Review>

  // ✅ RELATION CATEGORY (propre)
  @belongsTo(() => Category, {
    foreignKey: 'category_id',
  })
  declare category: BelongsTo<typeof Category>
}
