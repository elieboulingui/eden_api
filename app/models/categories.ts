// app/models/Category.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'

export default class Category extends BaseModel {
  static table = 'categories'

  @column({ isPrimary: true })
  declare id: string

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

  @column()
  declare user_id: string

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @hasMany(() => Category, {
    foreignKey: 'parent_id',
  })
  declare subCategories: HasMany<typeof Category>

  // ----------------------------
  // Champ product_ids sécurisé
  // ----------------------------
  @column({
    serializeAs: 'product_ids',
    consume: (value: string | null) => {
      if (!value) return []  // retourne un tableau vide si null ou vide
      try {
        return JSON.parse(value)
      } catch {
        return [] // retourne tableau vide si JSON invalide
      }
    },
    prepare: (value: string[]) => JSON.stringify(value),
  })
  declare product_ids: string[]

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @beforeCreate()
  static async generateUuid(category: Category) {
    if (!category.id) {
      category.id = crypto.randomUUID()
    }
    if (!category.slug && category.name) {
      category.slug = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    }
    if (!category.product_ids) {
      category.product_ids = []
    }
  }
}