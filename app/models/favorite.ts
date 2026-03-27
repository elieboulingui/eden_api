// app/Models/Favorite.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import User from './User.js'
import Product from './Product.js'
import { v4 as uuidv4 } from 'uuid'

export default class Favorite extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  @column()
  public userId: string  // UUID donc string

  @column()
  public productId: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => User, {
    foreignKey: 'userId',
    localKey: 'uuid'  // Important: User utilise 'uuid' comme clé primaire pour la relation
  })
  public user: BelongsTo<typeof User>

  @belongsTo(() => Product, {
    foreignKey: 'productId'
  })
  public product: BelongsTo<typeof Product>

  @beforeCreate()
  public static assignUuid(favorite: Favorite) {
    if (!favorite.id) {
      favorite.id = uuidv4()
    }
  }
}