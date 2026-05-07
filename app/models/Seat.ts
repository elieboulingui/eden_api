import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Boat from './Boat'
import Ticket from './Ticket'

export default class Seat extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  @column()
  public boat_id: string

  @column()
  public seat_number: string

  @column()
  public class: string

  @column()
  public deck: string | null

  @column()
  public position: string | null

  @column()
  public status: string

  @column()
  public price_modifier: number

  @column()
  public final_price: number | null

  @column()
  public is_window: boolean

  @column()
  public has_extra_legroom: boolean

  @column()
  public is_accessible: boolean

  @column()
  public metadata: object | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Boat)
  public boat: BelongsTo<typeof Boat>

  @hasMany(() => Ticket)
  public tickets: HasMany<typeof Ticket>
}
