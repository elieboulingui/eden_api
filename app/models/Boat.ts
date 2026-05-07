import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Seat from './Seat'
import Ticket from './Ticket'

export default class Boat extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  @column()
  public name: string

  @column()
  public registration_number: string

  @column()
  public type: string

  @column()
  public description: string | null

  @column()
  public total_seats: number

  @column()
  public available_seats: number

  @column()
  public economy_capacity: number

  @column()
  public business_capacity: number

  @column()
  public first_class_capacity: number

  @column()
  public vip_capacity: number

  @column()
  public economy_price: number

  @column()
  public business_price: number

  @column()
  public first_class_price: number

  @column()
  public vip_price: number

  @column()
  public status: string

  @column()
  public departure_port: string

  @column()
  public arrival_port: string

  @column()
  public route_code: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @hasMany(() => Seat)
  public seats: HasMany<typeof Seat>

  @hasMany(() => Ticket)
  public tickets: HasMany<typeof Ticket>
}
