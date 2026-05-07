import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Boat from './Boat'
import Seat from './Seat'
import Passenger from './Passenger'
import Payment from './Payment'

export default class Ticket extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  @column()
  public boat_id: string

  @column()
  public seat_id: string

  @column()
  public passenger_id: string

  @column()
  public trip_number: string

  @column()
  public travel_date: DateTime

  @column()
  public departure_time: DateTime

  @column()
  public arrival_time: DateTime

  @column()
  public base_price: number

  @column()
  public tax_amount: number

  @column()
  public discount_amount: number

  @column()
  public total_price: number

  @column()
  public payment_reference_id: string | null

  @column()
  public payment_method: string | null

  @column()
  public payment_status: string

  @column()
  public payment_gateway: string | null

  @column()
  public paid_at: DateTime | null

  @column()
  public status: string

  @column()
  public travel_class: string

  @column()
  public luggage_count: number

  @column()
  public luggage_weight: number

  @column()
  public luggage_fee: number

  @column()
  public has_meal: boolean

  @column()
  public has_insurance: boolean

  @column()
  public options_fee: number

  @column()
  public qr_code: string | null

  @column()
  public barcode: string | null

  @column()
  public has_boarded: boolean

  @column()
  public boarded_at: DateTime | null

  @column()
  public boarding_gate: string | null

  @column()
  public metadata: object | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Boat)
  public boat: BelongsTo<typeof Boat>

  @belongsTo(() => Seat)
  public seat: BelongsTo<typeof Seat>

  @belongsTo(() => Passenger)
  public passenger: BelongsTo<typeof Passenger>

  @hasMany(() => Payment)
  public payments: HasMany<typeof Payment>
}
