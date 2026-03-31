// app/models/Product.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Review from './review.js'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: string  // ← Changé en string pour UUID

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
  declare reviews_count: number

  @column()
  declare user_id: string  // ← Changé de userId à user_id pour cohérence

  // Add this inside your Product class
  @column()
  declare category_id: string | number | null

  // Also, I noticed your controller uses 'image_url' (snake_case)
  // but your model has 'imageUrl' (camelCase).
  // Pick one and stay consistent. If the DB is image_url:
  @column({ columnName: 'image_url' })
  declare imageUrl: string

  @column()
  declare category: string

  @column()
  declare origin: string

  @column()
  declare weight: string

  @column()
  declare packaging: string

  @column()
  declare conservation: string

  @column()
  declare isNew: boolean

  @column()
  declare isOnSale: boolean

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime  // ← Standardisé en snake_case

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime  // ← Standardisé en snake_case

  @beforeCreate()
  static assignUuid(product: Product) {
    product.id = crypto.randomUUID()
  }

  @column({ columnName: 'category_id' })
  declare categoryId: number | null

  // Relations
  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @hasMany(() => Review, {
    foreignKey: 'product_id',
  })
  declare reviews: HasMany<typeof Review>
}
