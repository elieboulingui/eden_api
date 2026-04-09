// app/models/testimonial.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import { randomUUID } from 'node:crypto' // ✅ UUID natif de Node.js
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
  declare user: any

  // ✅ UUID auto avec crypto natif
  @beforeCreate()
  static assignUuid(testimonial: Testimonial) {
    testimonial.id = randomUUID()
  }
}