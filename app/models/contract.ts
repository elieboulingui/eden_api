// app/models/contract.ts

import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/orm'
import Client from '#models/client'

export default class Contract extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare contractNumber: string

  @column()
  declare contractType: string // 'vendor_partnership', 'subscription', etc.

  @column()
  declare vendorInfo: object // Informations du vendeur (JSON)

  @column()
  declare signature: string // Base64 de la signature

  @column()
  declare status: 'draft' | 'signed' | 'sent' | 'expired' | 'cancelled'

  @column()
  declare signedAt: DateTime

  @column()
  declare expiresAt: DateTime

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

  // Relations
  @belongsTo(() => Client, {
    foreignKey: 'userId',
  })
  declare client: BelongsTo<typeof Client>
}
