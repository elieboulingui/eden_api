import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo, BelongsTo } from '@adonisjs/lucid/orm'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'

export default class Testimonial extends BaseModel {
  @column({ isPrimary: true })
  public id!: string

  @column()
  public userId!: string

  @column()
  public rating!: number

  @column()
  public text!: string

  @column.dateTime({ autoCreate: true })
  public createdAt!: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt!: DateTime

  // ✅ relation
  @belongsTo(() => User)
  public user!: BelongsTo<typeof User>

  // ✅ UUID auto
  @beforeCreate()
  public static assignUuid(testimonial: Testimonial) {
    testimonial.id = uuidv4()
  }
}