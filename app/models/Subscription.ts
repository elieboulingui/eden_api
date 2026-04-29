// app/models/Subscription.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Product from './Product.js'

export enum SubscriptionPlan { DAILY = 'daily', WEEKLY = 'weekly', BIWEEKLY = 'biweekly', MONTHLY = 'monthly' }
export enum SubscriptionStatus { ACTIVE = 'active', EXPIRED = 'expired', CANCELLED = 'cancelled', PENDING = 'pending' }
export enum SubscriptionType { ALL_PRODUCTS = 'all_products', SINGLE_PRODUCT = 'single_product' }

export const SUBSCRIPTION_PLANS: Record<string, any> = {
  daily: { name: 'Journalier', duration: 1, price: 4000, boostMultiplier: 2, maxProducts: 1, badge: '🔥 Boosté', level: 'boosted', color: 'orange', icon: 'Zap' },
  weekly: { name: 'Hebdomadaire', duration: 7, price: 15000, boostMultiplier: 3, maxProducts: 5, badge: '🚀 Boosté', level: 'boosted', color: 'blue', icon: 'Rocket' },
  biweekly: { name: '2 Semaines', duration: 14, price: 50000, boostMultiplier: 4, maxProducts: 15, badge: '👑 Premium', level: 'premium', color: 'purple', icon: 'Crown' },
  monthly: { name: 'Mensuel', duration: 30, price: 100000, boostMultiplier: 5, maxProducts: 999999, badge: '💎 Premium+', level: 'premium_plus', color: 'gold', icon: 'Diamond' },
}

export default class Subscription extends BaseModel {
  static table = 'subscriptions'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'user_id' })
  declare userId: string

  @column()
  declare plan: string

  @column()
  declare status: string

  @column({ columnName: 'subscription_type' })
  declare subscriptionType: string

  @column({ columnName: 'product_id' })
  declare productId: string | null

  @column()
  declare price: number

  @column({ columnName: 'boost_multiplier' })
  declare boostMultiplier: number

  @column({ columnName: 'max_products' })
  declare maxProducts: number

  @column({ columnName: 'payment_reference_id' })
  declare paymentReferenceId: string | null

  @column({ columnName: 'payment_method' })
  declare paymentMethod: string | null

  @column({ columnName: 'payment_status' })
  declare paymentStatus: string | null

  @column.dateTime({ columnName: 'start_date' })
  declare startDate: DateTime

  @column.dateTime({ columnName: 'end_date' })
  declare endDate: DateTime

  @column.dateTime({ columnName: 'cancelled_at' })
  declare cancelledAt: DateTime | null

  @column({ columnName: 'auto_renew' })
  declare autoRenew: boolean

  @column({ columnName: 'boosted_products_count' })
  declare boostedProductsCount: number

  @column({ columnName: 'total_views' })
  declare totalViews: number

  @column({ columnName: 'total_clicks' })
  declare totalClicks: number

  @column()
  declare metadata: any

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Product, { foreignKey: 'productId' })
  declare product: BelongsTo<typeof Product>

  @beforeCreate()
  static assignUuid(subscription: Subscription) {
    if (!subscription.id) subscription.id = crypto.randomUUID()
  }

  @beforeCreate()
  static setDefaults(subscription: Subscription) {
    subscription.status = subscription.status ?? 'pending'
    subscription.subscriptionType = subscription.subscriptionType ?? 'all_products'
    subscription.autoRenew = subscription.autoRenew ?? false
    subscription.boostedProductsCount = subscription.boostedProductsCount ?? 0
    subscription.totalViews = subscription.totalViews ?? 0
    subscription.totalClicks = subscription.totalClicks ?? 0
    subscription.metadata = subscription.metadata ?? {}
    const planConfig = SUBSCRIPTION_PLANS[subscription.plan]
    if (planConfig) {
      subscription.boostMultiplier = subscription.boostMultiplier ?? planConfig.boostMultiplier
      subscription.maxProducts = subscription.maxProducts ?? planConfig.maxProducts
    }
  }

  get planConfig(): any { return SUBSCRIPTION_PLANS[this.plan] }
  get planName(): string { return this.planConfig?.name || this.plan }
  get isActive(): boolean { return this.status === 'active' && this.endDate > DateTime.now() }
  get isForAllProducts(): boolean { return this.subscriptionType === 'all_products' }
  get isForSingleProduct(): boolean { return this.subscriptionType === 'single_product' }
  get remainingDays(): number { if (!this.endDate) return 0; return Math.max(0, Math.floor(this.endDate.diff(DateTime.now(), 'days').days)) }
  get remainingHours(): number { if (!this.endDate) return 0; return Math.max(0, Math.floor(this.endDate.diff(DateTime.now(), 'hours').hours)) }
  get color(): string { return this.planConfig?.color || 'gray' }
  get icon(): string { return this.planConfig?.icon || 'Star' }
  get badge(): string { return this.planConfig?.badge || '🔥 Boosté' }
  get boostLevel(): string { return this.planConfig?.level || 'boosted' }
  get canBoostMoreProducts(): boolean { return this.boostedProductsCount < this.maxProducts }

  async activate(): Promise<void> {
    const planConfig = this.planConfig
    if (!planConfig) throw new Error('Plan invalide')
    const now = DateTime.now()
    this.status = 'active'
    this.startDate = now
    this.endDate = now.plus({ days: planConfig.duration })
    this.paymentStatus = 'SUCCESS'
    await this.save()
  }

  async cancel(): Promise<void> {
    this.status = 'cancelled'
    this.cancelledAt = DateTime.now()
    this.endDate = DateTime.now()
    await this.save()
  }

  async expire(): Promise<void> {
    this.status = 'expired'
    await this.save()
  }

  async incrementViews(count: number = 1): Promise<void> { this.totalViews += count; await this.save() }
  async incrementClicks(count: number = 1): Promise<void> { this.totalClicks += count; await this.save() }

  async getBoostedProducts(): Promise<any[]> {
    try {
      const ProductModel = (await import('./Product.js')).default
      if (this.isForSingleProduct && this.productId) {
        const product = await ProductModel.find(this.productId)
        return product ? [product] : []
      }
      return ProductModel.query()
        .where('user_id', this.userId)
        .where('is_boosted', true)
        .where('boost_end_date', '>', DateTime.now().toISO())
    } catch {
      return []
    }
  }

  static async getActiveSubscription(userId: string): Promise<Subscription | null> {
    return Subscription.query()
      .where('userId', userId)
      .where('status', 'active')
      .where('endDate', '>', DateTime.now().toISO())
      .orderBy('endDate', 'desc')
      .first()
  }

  static async getActiveSubscriptionForProduct(productId: string): Promise<Subscription | null> {
    return Subscription.query()
      .where('productId', productId)
      .where('status', 'active')
      .where('endDate', '>', DateTime.now().toISO())
      .first()
  }

  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const sub = await Subscription.getActiveSubscription(userId)
    return sub !== null
  }

  static async getBoostMultiplier(userId: string): Promise<number> {
    const sub = await Subscription.getActiveSubscription(userId)
    return sub?.boostMultiplier || 1
  }

  static async expireStaleSubscriptions(): Promise<number> {
    const result = await Subscription.query()
      .where('status', 'active')
      .where('endDate', '<=', DateTime.now().toISO())
      .update({ status: 'expired' })
    
    // La méthode update() retourne un tableau dans certaines versions d'Adonis/Lucid
    return Array.isArray(result) ? result.length : (typeof result === 'number' ? result : 0)
  }
}
