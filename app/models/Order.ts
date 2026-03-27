// app/Models/Order.ts
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'

import OrderItem from './OrderItem.ts'

export default class Order extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  @column()
  public userId: string

  @column()
  public orderNumber: string

  @column()
  public status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

  @column()
  public total: number

  @column()
  public subtotal: number  // AJOUTER

  @column()
  public shippingCost: number  // AJOUTER

  @column()
  public deliveryMethod: string  // AJOUTER

  @column()
  public customerName: string

  @column()
  public customerEmail: string

  @column()
  public customerPhone: string | null

  @column()
  public shippingAddress: string

  @column()
  public billingAddress: string | null

  @column()
  public paymentMethod: string

  @column()
  public trackingNumber: string | null

  @column.dateTime()
  public estimatedDelivery: DateTime | null

  @column.dateTime()
  public deliveredAt: DateTime | null

  @column()
  public notes: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @hasMany(() => OrderItem, {
    foreignKey: 'orderId'
  })
  public items: HasMany<typeof OrderItem>
}