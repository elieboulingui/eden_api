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
  declare id: string  // UUID

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

  @column()
  declare user_id: string

  @column({ columnName: 'category_id' })
  declare category_id: string | null  // Correspond à la DB

  @column({ columnName: 'image_url' })
  declare image_url: string | null  // Assure que l'image soit stockée

  @column()
  declare category: string | null

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
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @beforeCreate()
  static assignUuid(product: Product) {
    if (!product.id) {
      product.id = crypto.randomUUID()
    }
  }

  // Relations
  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>
}