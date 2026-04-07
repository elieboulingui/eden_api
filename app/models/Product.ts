// app/models/Product.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Category from './categories.js'  // ✅ Ajouter l'import

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
  declare category_id: string | null

  @column({ columnName: 'image_url' })
  declare image_url: string | null

  @column()
  declare category: string | null  // Ancienne colonne textuelle (à garder pour compatibilité)

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

  @column()
  declare sales: number  // ✅ Ajouter si pas déjà présent

  @column()
  declare status: string  // ✅ Ajouter si pas déjà présent

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

  // ✅ Ajouter la relation avec Category
  @belongsTo(() => Category, {
    foreignKey: 'category_id',
  })
  declare categoryRelation: BelongsTo<typeof Category>
}