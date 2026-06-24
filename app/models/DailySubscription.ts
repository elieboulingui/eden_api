// app/models/DailySubscription.ts
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './User.js'
import Service from './Service.js'

export default class DailySubscription extends BaseModel {
  static table = 'daily_subscriptions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare client_id: string // L'utilisateur qui s'abonne

  @column()
  declare service_id: string // Le service auquel il s'abonne

  @column()
  declare merchant_id: string // Le marchand propriétaire du service

  @column()
  declare status: 'active' | 'inactive' | 'cancelled' | 'expired'

  @column.date()
  declare subscription_date: DateTime // La date de l'abonnement (jour)

  @column.date()
  declare valid_until: DateTime // Jusqu'à quand c'est valide (fin de journée)

  @column.dateTime()
  declare cancelled_at: DateTime | null

  @column.dateTime()
  declare last_renewal_at: DateTime | null

  @column()
  declare price_paid: number

  @column()
  declare currency: string

  @column()
  declare payment_method: string | null

  @column()
  declare payment_reference: string | null

  @column()
  declare auto_renew: boolean // Si true, se réabonne automatiquement le lendemain

  @column()
  declare metadata: JSON | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // Relations
  @belongsTo(() => User, {
    foreignKey: 'client_id',
    localKey: 'id',
  })
  declare client: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'merchant_id',
    localKey: 'id',
  })
  declare merchant: BelongsTo<typeof User>

  @belongsTo(() => Service, {
    foreignKey: 'service_id',
    localKey: 'id',
  })
  declare service: BelongsTo<typeof Service>

  // Getters
  get isActive(): boolean {
    if (this.status !== 'active') return false
    const now = DateTime.now()
    return this.valid_until > now
  }

  get isExpired(): boolean {
    if (this.status === 'expired') return true
    const now = DateTime.now()
    return this.valid_until < now
  }

  get isToday(): boolean {
    const today = DateTime.now().toFormat('yyyy-MM-dd')
    return this.subscription_date.toFormat('yyyy-MM-dd') === today
  }

  get daysRemaining(): number {
    const now = DateTime.now()
    const diff = this.valid_until.diff(now, 'hours').hours
    return Math.max(0, Math.ceil(diff / 24))
  }

  get hoursRemaining(): number {
    const now = DateTime.now()
    const diff = this.valid_until.diff(now, 'hours').hours
    return Math.max(0, Math.ceil(diff))
  }

  // Méthodes
  async cancel(): Promise<void> {
    this.status = 'cancelled'
    this.cancelled_at = DateTime.now()
    await this.save()
  }

  async expire(): Promise<void> {
    this.status = 'expired'
    await this.save()
  }

  async renew(): Promise<DailySubscription> {
    // Créer un nouvel abonnement pour le lendemain
    const tomorrow = DateTime.now().plus({ days: 1 }).startOf('day')
    
    const newSubscription = new DailySubscription()
    newSubscription.id = crypto.randomUUID()
    newSubscription.client_id = this.client_id
    newSubscription.service_id = this.service_id
    newSubscription.merchant_id = this.merchant_id
    newSubscription.status = 'active'
    newSubscription.subscription_date = tomorrow
    newSubscription.valid_until = tomorrow.endOf('day')
    newSubscription.price_paid = this.price_paid
    newSubscription.currency = this.currency
    newSubscription.payment_method = this.payment_method
    newSubscription.auto_renew = this.auto_renew
    newSubscription.last_renewal_at = DateTime.now()
    
    await newSubscription.save()
    
    // Marquer l'ancien comme expiré
    this.status = 'expired'
    await this.save()
    
    return newSubscription
  }

  async checkAndRenewIfNeeded(): Promise<DailySubscription | null> {
    // Si l'abonnement est actif et expire aujourd'hui et auto_renew est true
    if (this.isActive && this.isExpiringToday() && this.auto_renew) {
      return await this.renew()
    }
    return null
  }

  private isExpiringToday(): boolean {
    const today = DateTime.now().toFormat('yyyy-MM-dd')
    return this.valid_until.toFormat('yyyy-MM-dd') === today
  }
}
