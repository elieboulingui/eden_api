// app/models/Product.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Category from './categories.js'
import Review from './review.js'
import OrderItem from './OrderItem.js'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare price: number

  @column()
  declare old_price: number | null

  @column()
  declare description: string

  @column()
  declare stock: number

  @column()
  declare rating: number

  @column()
  declare reviews_count: number

  @column()
  declare user_id: string

  @column({ columnName: 'category_id' })
  declare category_id: string | null

  @column({ columnName: 'image_url' })
  declare image_url: string | null

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

  @column({ columnName: 'is_new' })
  declare isNew: boolean

  @column({ columnName: 'is_on_sale' })
  declare isOnSale: boolean

  @column()
  declare sales: number

  @column()
  declare likes: number

  @column()
  declare status: string

  @column({ columnName: 'is_archived' })
  declare isArchived: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @beforeCreate()
  static assignUuid(product: Product) {
    if (!product.id) {
      product.id = crypto.randomUUID()
    }
  }

  @beforeCreate()
  static setDefaults(product: Product) {
    product.isArchived = product.isArchived ?? false
    product.isNew = product.isNew ?? true
    product.isOnSale = product.isOnSale ?? false
    product.stock = product.stock ?? 0
    product.sales = product.sales ?? 0
    product.likes = product.likes ?? 0
    product.rating = product.rating ?? 0
    product.reviews_count = product.reviews_count ?? 0
    product.status = product.status ?? 'active'
  }

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Category, { foreignKey: 'category_id' })
  declare categoryRelation: BelongsTo<typeof Category>

  @hasMany(() => Review, { foreignKey: 'product_id' })
  declare reviews: HasMany<typeof Review>

  @hasMany(() => OrderItem, { foreignKey: 'product_id' })
  declare orderItems: HasMany<typeof OrderItem>

  get discountPercentage(): number | null {
    if (this.old_price && this.old_price > this.price) {
      return Math.round(((this.old_price - this.price) / this.old_price) * 100)
    }
    return null
  }

  get isInStock(): boolean {
    return this.stock > 0
  }

  get hasDiscount(): boolean {
    return this.old_price !== null && this.old_price > this.price
  }

  async archive(): Promise<void> {
    this.isArchived = true
    this.status = 'inactive'
    await this.save()
  }

  async unarchive(): Promise<void> {
    this.isArchived = false
    this.status = 'active'
    await this.save()
  }
}