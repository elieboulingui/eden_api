// app/Models/OrderTracking.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Order from '#models/Order'

export default class OrderTracking extends BaseModel {
  // AJOUTEZ CETTE LIGNE POUR FORCER LE NOM DE LA TABLE
  public static table = 'order_tracking'

  @column({ isPrimary: true })
  public id: number

  @column()
  public orderId: string

  @column()
  public status: string

  @column()
  public location: string | null

  @column()
  public description: string | null

  @column.dateTime()
  public trackedAt: DateTime

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Order, {
    foreignKey: 'orderId'
  })
  public order: BelongsTo<typeof Order>
}