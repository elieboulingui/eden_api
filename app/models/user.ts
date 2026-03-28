// app/models/User.ts
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, hasOne, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Product from './Product.js'
import Review from './review.js'
import Wallet from './wallet.js'

const AuthFinder = withAuthFinder(hash, {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  static table = 'users'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare full_name: string | null

  @column()
  declare email: string

  @column()
  declare uuid: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: 'superadmin' | 'admin' | 'client' | 'marchant' | 'merchant'

  @column()
  declare avatar: string | null

  @column()
  declare phone: string | null

  @column()
  declare address: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @hasMany(() => Product, {
    foreignKey: 'user_id',
  })
  declare products: HasMany<typeof Product>

  @hasMany(() => Review, {
    foreignKey: 'merchant_id',
    localKey: 'id',
  })
  declare reviews: HasMany<typeof Review>

  @hasOne(() => Wallet, {
    foreignKey: 'user_id',
    localKey: 'id',
  })
  declare wallet: HasOne<typeof Wallet>

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '7 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  get isSuperAdmin(): boolean {
    return this.role === 'superadmin'
  }

  get isAdmin(): boolean {
    return this.role === 'admin' || this.role === 'superadmin'
  }

  get isClient(): boolean {
    return this.role === 'client'
  }

  get isMerchant(): boolean {
    return this.role === 'marchant' || this.role === 'merchant'
  }

  get initials() {
    const name = this.full_name || this.email
    const [first, last] = name.split(' ')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }

  async ensureMerchant(): Promise<void> {
    if (!this.isMerchant) {
      throw new Error('Accès non autorisé. Seuls les marchands peuvent effectuer cette action.')
    }
  }

  async getWalletBalance(): Promise<number> {
    await this.load('wallet' as any)
    return this.wallet?.balance || 0
  }

  async getAverageRating(): Promise<number> {
    const result = await Review.query()
      .whereHas('product', (query) => {
        query.where('user_id', this.id)
      })
      .avg('rating as average')
    return Number.parseFloat(result[0].$extras.average) || 0
  }

  async getTotalReviews(): Promise<number> {
    const result = await Review.query()
      .whereHas('product', (query) => {
        query.where('user_id', this.id)
      })
      .count('* as total')
    return Number.parseInt(result[0].$extras.total) || 0
  }

  @beforeCreate()
  static async generateUuid(user: User) {
    if (!user.id) {
      user.id = uuidv4()
    }
    if (!user.uuid) {
      user.uuid = uuidv4()
    }
  }
}