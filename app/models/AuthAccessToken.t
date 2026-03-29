import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class AuthAccessToken extends BaseModel {
  static table = 'auth_access_tokens'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tokenable_id: string

  @column()
  declare type: string

  @column()
  declare name: string | null

  @column()
  declare hash: string

  @column()
  declare abilities: string[]

  @column.dateTime()
  declare last_used_at: Date | null

  @column.dateTime()
  declare expires_at: Date | null

  @column.dateTime({ autoCreate: true })
  declare created_at: Date

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: Date
}
