import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate } from '@adonisjs/lucid/orm'
import crypto from 'node:crypto'

export default class Promotion extends BaseModel {
  @column({ isPrimary: true })
  declare id: string  // string pour UUID

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare image_url: string | null

  @column()
  declare banner_image: string | null

  @column()
  declare type: 'banner' | 'flash_sale' | 'category_offer'

  @column()
  declare discount_percentage: number | null

  @column()
  declare discount_amount: number | null

  @column()
  declare category: string | null

  @column()
  declare product_ids: string | null

  @column()
  declare link: string | null

  @column()
  declare button_text: string

  @column()
  declare min_order_amount: number | null

  @column.date()
  declare start_date: DateTime | null

  @column.date()
  declare end_date: DateTime | null

  @column()
  declare status: 'active' | 'expired' | 'upcoming' | 'disabled'

  @column()
  declare priority: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @beforeCreate()
  static ensureUuid(promotion: Promotion) {
    if (!promotion.id) {
      promotion.id = crypto.randomUUID()
    }
  }

  // Accesseur pour récupérer les product_ids en tableau
  get productIdsArray(): string[] | null {
    if (!this.product_ids) return null
    try {
      return JSON.parse(this.product_ids)
    } catch {
      return null
    }
  }
}
