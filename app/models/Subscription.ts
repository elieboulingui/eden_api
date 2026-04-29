// app/models/Subscription.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'

export enum SubscriptionPlan {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

export const SUBSCRIPTION_PLANS = {
  [SubscriptionPlan.DAILY]: {
    name: 'Journalier',
    duration: 1, // 1 jour
    price: 4000,
    boostMultiplier: 2, // Boost x2 visibilité
    features: [
      'Visibilité boostée pendant 24h',
      'Apparition en page d\'accueil',
      'Badge "Boosté" sur vos produits',
      'Priorité dans les résultats de recherche',
    ],
    color: 'orange',
    icon: 'Zap',
  },
  [SubscriptionPlan.WEEKLY]: {
    name: 'Hebdomadaire',
    duration: 7, // 7 jours
    price: 15000,
    boostMultiplier: 3,
    features: [
      'Visibilité boostée pendant 7 jours',
      'Apparition prioritaire en page d\'accueil',
      'Badge "Boosté" sur vos produits',
      'Top des résultats de recherche',
      'Mise en avant dans la newsletter',
    ],
    color: 'blue',
    icon: 'Rocket',
  },
  [SubscriptionPlan.BIWEEKLY]: {
    name: '2 Semaines',
    duration: 14, // 14 jours
    price: 50000,
    boostMultiplier: 4,
    features: [
      'Visibilité boostée pendant 14 jours',
      'Position premium en page d\'accueil',
      'Badge "Premium" sur vos produits',
      'Top absolu des résultats de recherche',
      'Mise en avant newsletter + réseaux sociaux',
      'Statistiques de visibilité avancées',
    ],
    color: 'purple',
    icon: 'Crown',
  },
  [SubscriptionPlan.MONTHLY]: {
    name: 'Mensuel',
    duration: 30, // 30 jours
    price: 100000,
    boostMultiplier: 5,
    features: [
      'Visibilité maximale pendant 30 jours',
      'Position ultra-premium en page d\'accueil',
      'Badge "Premium+" sur vos produits',
      'Top absolu des résultats de recherche',
      'Mise en avant newsletter + réseaux sociaux',
      'Statistiques détaillées + rapport hebdomadaire',
      'Support prioritaire',
      'Produits épinglés dans la catégorie',
    ],
    color: 'gold',
    icon: 'Diamond',
  },
}

export default class Subscription extends BaseModel {
  static table = 'subscriptions'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'user_id' })
  declare userId: string

  @column({ columnName: 'plan' })
  declare plan: SubscriptionPlan

  @column({ columnName: 'status' })
  declare status: SubscriptionStatus

  @column({ columnName: 'price' })
  declare price: number

  @column({ columnName: 'boost_multiplier' })
  declare boostMultiplier: number

  @column({ columnName: 'payment_reference_id' })
  declare paymentReferenceId: string | null

  @column({ columnName: 'payment_method' })
  declare paymentMethod: string | null

  @column({ columnName: 'payment_status' })
  declare paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | null

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

  @column({ columnName: 'metadata' })
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  // ==================== RELATIONS ====================

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  // ==================== HOOKS ====================

  @beforeCreate()
  static assignUuid(subscription: Subscription) {
    if (!subscription.id) {
      subscription.id = crypto.randomUUID()
    }
  }

  @beforeCreate()
  static setDefaults(subscription: Subscription) {
    subscription.status = subscription.status ?? SubscriptionStatus.PENDING
    subscription.autoRenew = subscription.autoRenew ?? false
    subscription.boostedProductsCount = subscription.boostedProductsCount ?? 0
    subscription.totalViews = subscription.totalViews ?? 0
    subscription.totalClicks = subscription.totalClicks ?? 0
    subscription.metadata = subscription.metadata ?? {}
  }

  // ==================== GETTERS ====================

  get planConfig() {
    return SUBSCRIPTION_PLANS[this.plan]
  }

  get planName(): string {
    return this.planConfig?.name || this.plan
  }

  get isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE && this.endDate > DateTime.now()
  }

  get isExpired(): boolean {
    return this.status === SubscriptionStatus.EXPIRED || this.endDate <= DateTime.now()
  }

  get remainingDays(): number {
    if (!this.endDate) return 0
    const now = DateTime.now()
    const diff = this.endDate.diff(now, 'days').days
    return Math.max(0, Math.floor(diff))
  }

  get remainingHours(): number {
    if (!this.endDate) return 0
    const now = DateTime.now()
    const diff = this.endDate.diff(now, 'hours').hours
    return Math.max(0, Math.floor(diff))
  }

  get progressPercentage(): number {
    if (!this.startDate || !this.endDate) return 0
    const total = this.endDate.diff(this.startDate, 'hours').hours
    const elapsed = DateTime.now().diff(this.startDate, 'hours').hours
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }

  get color(): string {
    return this.planConfig?.color || 'gray'
  }

  get icon(): string {
    return this.planConfig?.icon || 'Star'
  }

  get dailyPrice(): number {
    const duration = this.planConfig?.duration || 1
    return Math.round(this.price / duration)
  }

  get savings(): number | null {
    // Calculer les économies par rapport au plan journalier
    const duration = this.planConfig?.duration || 1
    const dailyTotal = 4000 * duration
    const diff = dailyTotal - this.price
    return diff > 0 ? diff : null
  }

  get savingsPercentage(): number | null {
    const duration = this.planConfig?.duration || 1
    const dailyTotal = 4000 * duration
    return Math.round(((dailyTotal - this.price) / dailyTotal) * 100)
  }

  // ==================== MÉTHODES ====================

  async activate(): Promise<void> {
    const planConfig = this.planConfig
    if (!planConfig) throw new Error('Plan invalide')

    const now = DateTime.now()
    this.status = SubscriptionStatus.ACTIVE
    this.startDate = now
    this.endDate = now.plus({ days: planConfig.duration })
    this.boostMultiplier = planConfig.boostMultiplier
    await this.save()
  }

  async cancel(): Promise<void> {
    this.status = SubscriptionStatus.CANCELLED
    this.cancelledAt = DateTime.now()
    this.endDate = DateTime.now() // Termine immédiatement
    await this.save()
  }

  async expire(): Promise<void> {
    this.status = SubscriptionStatus.EXPIRED
    await this.save()
  }

  async renew(): Promise<Subscription> {
    const planConfig = this.planConfig
    if (!planConfig) throw new Error('Plan invalide')

    // Créer un nouvel abonnement
    const newSubscription = await Subscription.create({
      userId: this.userId,
      plan: this.plan,
      status: SubscriptionStatus.PENDING,
      price: planConfig.price,
      boostMultiplier: planConfig.boostMultiplier,
      autoRenew: this.autoRenew,
      metadata: { renewedFrom: this.id },
    })

    return newSubscription
  }

  async incrementViews(count: number = 1): Promise<void> {
    this.totalViews += count
    await this.save()
  }

  async incrementClicks(count: number = 1): Promise<void> {
    this.totalClicks += count
    await this.save()
  }

  async updateBoostedProductsCount(count: number): Promise<void> {
    this.boostedProductsCount = count
    await this.save()
  }

  async checkAndUpdateStatus(): Promise<void> {
    if (this.isActive && this.endDate <= DateTime.now()) {
      await this.expire()
    }
  }

  // ==================== MÉTHODES STATIQUES ====================

  static async getActiveSubscription(userId: string): Promise<Subscription | null> {
    return Subscription.query()
      .where('userId', userId)
      .where('status', SubscriptionStatus.ACTIVE)
      .where('endDate', '>', DateTime.now().toSQL())
      .orderBy('endDate', 'desc')
      .first()
  }

  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const sub = await Subscription.getActiveSubscription(userId)
    return sub !== null
  }

  static async getBoostedMerchants(): Promise<User[]> {
    const activeSubs = await Subscription.query()
      .where('status', SubscriptionStatus.ACTIVE)
      .where('endDate', '>', DateTime.now().toSQL())
      .preload('user')
      .orderBy('boostMultiplier', 'desc')

    return activeSubs.map(sub => sub.user).filter(Boolean)
  }

  static async getBoostMultiplier(userId: string): Promise<number> {
    const sub = await Subscription.getActiveSubscription(userId)
    return sub?.boostMultiplier || 1
  }

  static async expireStaleSubscriptions(): Promise<number> {
    const expired = await Subscription.query()
      .where('status', SubscriptionStatus.ACTIVE)
      .where('endDate', '<=', DateTime.now().toSQL())
      .update({ status: SubscriptionStatus.EXPIRED })

    return expired
  }
}
