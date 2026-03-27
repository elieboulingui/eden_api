// app/Models/OrderItem.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Order from './Order.ts'
import Product from './Product.ts'

export default class OrderItem extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public orderId: string

  @column()
  public productId: number

  @column()
  public productName: string

  @column()
  public productDescription: string | null

  @column()
  public price: number

  @column()
  public quantity: number

  @column()
  public category: string | null

  @column()
  public image: string | null

  @column()
  public subtotal: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Order, {
    foreignKey: 'orderId'
  })
  public order: BelongsTo<typeof Order>

  @belongsTo(() => Product, {
    foreignKey: 'productId'
  })
  public product: BelongsTo<typeof Product>
}