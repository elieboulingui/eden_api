import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import Product from './Product.ts'

export default class Coupon extends BaseModel {
  static table = 'coupons'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: string

  @column()
  declare discount: number

  @column()
  declare type: 'percentage' | 'fixed'

  @column()
  declare description: string | null

  @column()
  declare valid_from: DateTime | null

  @column()
  declare valid_until: DateTime | null

  @column()
  declare usage_limit: number

  @column()
  declare used_count: number

  @column()
  declare minimum_order_amount: number | null

  @column()
  declare maximum_discount_amount: number | null

  @column()
  declare product_id: string | null

  @column()
  declare status: 'active' | 'expired' | 'disabled'

  @column()
  declare user_id: string  // ← Nouvelle colonne

  // Nouveau : tableau d'UUID pour stocker les utilisateurs ayant utilisé le coupon
  @column()
  declare userIds: string[]

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relation avec le produit (optionnelle)
  @belongsTo(() => Product, { foreignKey: 'product_id' })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static async generateUuid(coupon: Coupon) {
    if (!coupon.id) coupon.id = crypto.randomUUID()
    if (!coupon.used_count) coupon.used_count = 0
    if (!coupon.status) coupon.status = 'active'
    if (!coupon.userIds) coupon.userIds = []
  }

  // Vérifier si le coupon est valide
  isValid(): boolean {
    const now = DateTime.now()
    if (this.status !== 'active') return false
    if (this.valid_from && this.valid_from > now) return false
    if (this.valid_until && this.valid_until < now) return false
    if (this.usage_limit && this.used_count >= this.usage_limit) return false
    return true
  }

  // Calculer le montant de la réduction
  calculateDiscount(amount: number): number {
    if (!this.isValid()) return 0
    let discountAmount = 0
    if (this.type === 'percentage') {
      discountAmount = (amount * this.discount) / 100
      if (this.maximum_discount_amount && discountAmount > this.maximum_discount_amount) {
        discountAmount = this.maximum_discount_amount
      }
    } else {
      discountAmount = this.discount
    }
    if (discountAmount > amount) discountAmount = amount
    return discountAmount
  }

  // Incrémenter le compteur d'utilisation
  async incrementUsage(quantity = 1): Promise<void> {
    this.used_count += quantity
    await this.save()
  }
}
