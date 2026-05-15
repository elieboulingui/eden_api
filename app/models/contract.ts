// app/models/contract.ts

import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Contract extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID = string

  @column()
  declare userId: string | null // UUID = string

  @column()
  declare contractNumber: string

  @column()
  declare contractType: string

  @column()
  declare vendorInfo: object

  @column()
  declare signature: string

  @column()
  declare status: string

  @column.dateTime()
  declare signedAt: DateTime

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column()
  declare adminEmail: string

  @column()
  declare vendorEmail: string

  @column()
  declare pdfPath: string | null

  @column()
  declare metadata: object | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
