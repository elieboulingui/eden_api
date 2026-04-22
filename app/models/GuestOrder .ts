// app/models/GuestOrder.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import crypto from 'node:crypto'

export default class GuestOrder extends BaseModel {
  static table = 'guest_orders'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare guestId: string

  @column()
  declare customerName: string

  @column()
  declare customerEmail: string

  @column()
  declare customerPhone: string

  @column()
  declare kycId: string | null

  @column()
  declare orderId: string | null

  @column()
  declare status: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeCreate()
  static assignUuid(guestOrder: GuestOrder) {
    if (!guestOrder.id) {
      guestOrder.id = crypto.randomUUID()
    }
  }

  @beforeCreate()
  static setDefaults(guestOrder: GuestOrder) {
    guestOrder.status = guestOrder.status ?? 'pending'
  }
}
