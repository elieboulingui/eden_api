// app/models/Pub.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import crypto from 'node:crypto'

export default class Pub extends BaseModel {
  static table = 'pubs'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare image_url: string

  @column()
  declare display_duration: number // Durée d'affichage en secondes

  @column()
  declare start_date: DateTime | null // Date de début d'affichage

  @column()
  declare end_date: DateTime | null // Date de fin d'affichage

  @column()
  declare is_active: boolean // Statut actif/inactif

  @column()
  declare priority: number // Priorité d'affichage (1 = haute, 2 = moyenne, 3 = basse)

  @column()
  declare target_url: string | null // URL de redirection (optionnel)

  @column()
  declare merchant_id: string | null // ID du marchand (si pub liée à un marchand spécifique)

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @column.dateTime()
  declare deleted_at: DateTime | null

  @beforeCreate()
  static async generateUuid(pub: Pub) {
    if (!pub.id) {
      pub.id = crypto.randomUUID()
    }
  }
}