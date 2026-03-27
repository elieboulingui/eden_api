// app/models/review.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Product from './product.js'
import User from './user.js'

export default class Review extends BaseModel {
  static table = 'reviews'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare rating: number

  @column()
  declare comment: string | null

  @column()
  declare user_id: string

  @column()
  declare product_id: string

  @column()
  declare merchant_id: string // Ajout de cette colonne pour lier directement au marchand

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relation avec le produit
  @belongsTo(() => Product, {
    foreignKey: 'product_id',
  })
  declare product: BelongsTo<typeof Product>

  // Relation avec l'utilisateur qui a fait l'avis
  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  // Nouvelle relation avec le marchand
  @belongsTo(() => User, {
    foreignKey: 'merchant_id',
  })
  declare merchant: BelongsTo<typeof User>
}
