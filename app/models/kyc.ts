import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import { randomUUID } from 'node:crypto'

export default class KYC extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare nomComplet: string

  @column()
  declare numeroTelephone: string

  @column()
  declare operateur: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeCreate()
  static assignUuid(kyc: KYC) {
    kyc.id = randomUUID()
  }
}
