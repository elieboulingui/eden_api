// app/models/category.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Product from './Product.js'
import User from './user.js'

export default class Category extends BaseModel {
  static table = 'categories'

  @column({ isPrimary: true })
  declare id: string // UUID en string

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare image_url: string | null

  @column()
  declare icon_name: string | null

  @column()
  declare parent_id: string | null

  @column()
  declare product_count: number

  @column()
  declare is_active: boolean

  @column()
  declare sort_order: number

  // AJOUTEZ CETTE LIGNE - c'est ce qui manquait
  @column()
  declare user_id: number  // ou string selon le type de votre User.id

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @hasMany(() => Product, {
    foreignKey: 'category_id',
  })
  declare products: HasMany<typeof Product>

  @hasMany(() => Category, {
    foreignKey: 'parent_id',
  })
  declare subCategories: HasMany<typeof Category>

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}