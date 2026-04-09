// app/models/testimonial.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations' // ✅ Import depuis types/relations
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'

export default class Testimonial extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare rating: number

  @column()
  declare text: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ✅ Relation
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  // ✅ UUID auto
  @beforeCreate()
  static assignUuid(testimonial: Testimonial) {
    testimonial.id = uuidv4()
  }
}