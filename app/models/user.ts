// app/models/User.ts
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, hasOne, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import crypto from 'node:crypto'
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
  declare password: string

  @column()
  declare role: 'superadmin' | 'admin' | 'client' | 'marchant' | 'merchant'

  @column()
  declare avatar: string | null

  @column()
  declare phone: string | null

  @column()
  declare address: string | null

  @column()
  declare country: string | null

  @column()
  declare neighborhood: string | null

  // ============================================================
  // ÉTAPE 1 : INFORMATIONS DU RESPONSABLE (MARCHAND)
  // ============================================================

  @column.date({ columnName: 'birth_date' })
  declare birth_date: DateTime | null

  @column({ columnName: 'id_number' })
  declare id_number: string | null

  @column({ columnName: 'id_front_url' })
  declare id_front_url: string | null

  @column({ columnName: 'id_back_url' })
  declare id_back_url: string | null

  @column({ columnName: 'selfie_url' })
  declare selfie_url: string | null

  @column({ columnName: 'personal_phone' })
  declare personal_phone: string | null

  @column({ columnName: 'is_phone_verified' })
  declare is_phone_verified: boolean

  @column({ columnName: 'is_email_verified' })
  declare is_email_verified: boolean

  @column({ columnName: 'residence_address' })
  declare residence_address: string | null

  // ============================================================
  // ÉTAPE 2 : TYPE D'ACTIVITÉ
  // ============================================================

  @column({ columnName: 'vendor_type' })
  declare vendor_type: 'boutique_physique' | 'vendeur_ligne' | 'particulier' | null

  @column({ columnName: 'nif_number' })
  declare nif_number: string | null

  @column({ columnName: 'rccm_number' })
  declare rccm_number: string | null

  @column({ columnName: 'rccm_document_url' })
  declare rccm_document_url: string | null

  @column({ columnName: 'commercial_name' })
  declare commercial_name: string | null

  @column({ columnName: 'shop_name' })
  declare shop_name: string | null

  @column({ columnName: 'whatsapp_phone' })
  declare whatsapp_phone: string | null

  @column({ columnName: 'is_whatsapp_verified' })
  declare is_whatsapp_verified: boolean

  @column({ columnName: 'shop_description' })
  declare shop_description: string | null

  @column({ columnName: 'logo_url' })
  declare logo_url: string | null

  @column({ columnName: 'shop_image' })
  declare shop_image: string | null

  @column({ columnName: 'cover_photo_url' })
  declare cover_photo_url: string | null

  // ============================================================
  // BLOC 4 : BOUTIQUE PHYSIQUE (AVEC UNDERSCORES)
  // ============================================================

  @column({ columnName: 'shop_address' })
  declare shop_address: string | null

  @column({ columnName: 'shop_latitude' })
  declare shop_latitude: number | null

  @column({ columnName: 'shop_longitude' })
  declare shop_longitude: number | null

  @column({ columnName: 'facade_photo_1_url' })
  declare facade_photo1_url: string | null

  @column({ columnName: 'facade_photo_2_url' })
  declare facade_photo2_url: string | null

  @column({ columnName: 'interior_photo_1_url' })
  declare interior_photo1_url: string | null

  @column({ columnName: 'interior_photo_2_url' })
  declare interior_photo2_url: string | null

  @column({ columnName: 'seeg_or_lease_url' })
  declare seeg_or_lease_url: string | null

  // ============================================================
  // BLOC 5 : VENDEUR EN LIGNE / PARTICULIER
  // ============================================================

  @column({ columnName: 'stock_address' })
  declare stock_address: string | null

  @column({ columnName: 'address_proof_url' })
  declare address_proof_url: string | null

  @column({ columnName: 'facebook_url' })
  declare facebook_url: string | null

  @column({ columnName: 'instagram_url' })
  declare instagram_url: string | null

  @column({ columnName: 'tiktok_url' })
  declare tiktok_url: string | null

  @column({ columnName: 'stock_video_url' })
  declare stock_video_url: string | null

  @column({ columnName: 'reference_1_name' })
  declare reference1_name: string | null

  @column({ columnName: 'reference_1_phone' })
  declare reference1_phone: string | null

  @column({ columnName: 'reference_2_name' })
  declare reference2_name: string | null

  @column({ columnName: 'reference_2_phone' })
  declare reference2_phone: string | null

  // ============================================================
  // ÉTAPE 3 : PAIEMENT ET VALIDATION
  // ============================================================

  @column({ columnName: 'payment_method' })
  declare payment_method: 'airtel_money' | 'moov_money' | 'virement_bancaire' | null

  @column({ columnName: 'airtel_number' })
  declare airtel_number: string | null

  @column({ columnName: 'moov_number' })
  declare moov_number: string | null

  @column({ columnName: 'account_holder_name' })
  declare account_holder_name: string | null

  @column({ columnName: 'bank_name' })
  declare bank_name: string | null

  @column({ columnName: 'rib_document_url' })
  declare rib_document_url: string | null

  // ============================================================
  // VALIDATION ET ENGAGEMENT
  // ============================================================

  @column({ columnName: 'certify_truth' })
  declare certify_truth: boolean

  @column({ columnName: 'accept_escrow' })
  declare accept_escrow: boolean

  @column({ columnName: 'signature' })
  declare signature: string | null

  // ============================================================
  // STATUT DE VÉRIFICATION
  // ============================================================

  @column({ columnName: 'is_verified' })
  declare is_verified: boolean

  @column({ columnName: 'verification_status' })
  declare verification_status: 'pending' | 'approved' | 'rejected' | null

  @column.date({ columnName: 'verified_at' })
  declare verified_at: DateTime | null

  @column({ columnName: 'verified_by' })
  declare verified_by: string | null

  @column({ columnName: 'rejection_reason' })
  declare rejection_reason: string | null

  // ============================================================
  // TIMESTAMPS
  // ============================================================

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updated_at: DateTime

  // ============================================================
  // RELATIONS
  // ============================================================

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

  // ============================================================
  // ACCESS TOKENS
  // ============================================================

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '7 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  // ============================================================
  // HOOKS
  // ============================================================

  @beforeCreate()
  static assignUuid(user: User) {
    user.id = crypto.randomUUID()
  }

  @beforeCreate()
  static setDefaults(user: User) {
    user.is_phone_verified = user.is_phone_verified ?? false
    user.is_email_verified = user.is_email_verified ?? false
    user.is_whatsapp_verified = user.is_whatsapp_verified ?? false
    user.certify_truth = user.certify_truth ?? false
    user.accept_escrow = user.accept_escrow ?? false
    user.is_verified = user.is_verified ?? false
    user.verification_status = user.verification_status ?? 'pending'
  }

  // ============================================================
  // GETTERS
  // ============================================================

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

  get hasCompletedRegistration(): boolean {
    if (!this.isMerchant) return true

    const step1Complete = !!(
      this.birth_date &&
      this.id_number &&
      this.id_front_url &&
      this.id_back_url &&
      this.selfie_url &&
      this.is_phone_verified &&
      this.is_email_verified &&
      this.residence_address
    )

    const step2Complete = !!(
      this.vendor_type &&
      this.commercial_name &&
      this.is_whatsapp_verified &&
      this.shop_description
    )

    let specificComplete = false
    if (this.vendor_type === 'boutique_physique') {
      specificComplete = !!(
        this.shop_address &&
        this.shop_latitude &&
        this.shop_longitude &&
        this.facade_photo1_url &&
        this.facade_photo2_url &&
        this.interior_photo1_url &&
        this.interior_photo2_url &&
        this.seeg_or_lease_url
      )
    } else if (this.vendor_type === 'vendeur_ligne' || this.vendor_type === 'particulier') {
      specificComplete = !!(
        this.stock_address &&
        this.address_proof_url &&
        this.stock_video_url &&
        this.reference1_name &&
        this.reference1_phone &&
        this.reference2_name &&
        this.reference2_phone
      )
    }

    const step3Complete = !!(
      this.payment_method &&
      this.certify_truth &&
      this.accept_escrow &&
      this.signature
    )

    let paymentComplete = false
    if (this.payment_method === 'airtel_money') {
      paymentComplete = !!(this.airtel_number && this.account_holder_name)
    } else if (this.payment_method === 'moov_money') {
      paymentComplete = !!(this.moov_number && this.account_holder_name)
    } else if (this.payment_method === 'virement_bancaire') {
      paymentComplete = !!(this.bank_name && this.rib_document_url)
    }

    return step1Complete && step2Complete && specificComplete && step3Complete && paymentComplete
  }

  get vendorTypeLabel(): string | null {
    const labels = {
      'boutique_physique': 'Boutique physique',
      'vendeur_ligne': 'Vendeur en ligne',
      'particulier': 'Particulier',
    }
    return this.vendor_type ? labels[this.vendor_type] : null
  }

  get verificationStatusLabel(): string {
    const labels = {
      'pending': 'En attente',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
    }
    return this.verification_status ? labels[this.verification_status] : 'En attente'
  }

  // ============================================================
  // MÉTHODES
  // ============================================================

  async ensureMerchant(): Promise<void> {
    if (!this.isMerchant) {
      throw new Error('Accès non autorisé. Seuls les marchands peuvent effectuer cette action.')
    }
  }

  async ensureVerified(): Promise<void> {
    await this.ensureMerchant()
    if (!this.is_verified) {
      throw new Error('Votre compte marchand n\'a pas encore été vérifié.')
    }
  }

  async getWalletBalance(): Promise<number> {
    const wallet = await Wallet
      .query()
      .where('user_id', this.id)
      .first()

    return wallet?.balance ?? 0
  }

  // ✅ Correction : Utiliser directement la relation merchant_id
  async getAverageRating(): Promise<number> {
    const result = await Review.query()
      .where('merchant_id', this.id)
      .avg('rating as average')
      .first()

    return Number.parseFloat(result?.$extras?.average) || 0
  }

  // ✅ Correction : Utiliser directement la relation merchant_id
  async getTotalReviews(): Promise<number> {
    const result = await Review.query()
      .where('merchant_id', this.id)
      .count('* as total')
      .first()

    return Number.parseInt(result?.$extras?.total) || 0
  }

  async approve(adminId: string): Promise<void> {
    this.is_verified = true
    this.verification_status = 'approved'
    this.verified_at = DateTime.now()
    this.verified_by = adminId
    this.rejection_reason = null
    await this.save()
  }

  async reject(adminId: string, reason: string): Promise<void> {
    this.is_verified = false
    this.verification_status = 'rejected'
    this.verified_at = DateTime.now()
    this.verified_by = adminId
    this.rejection_reason = reason
    await this.save()
  }

  async pending(): Promise<void> {
    this.is_verified = false
    this.verification_status = 'pending'
    this.verified_at = null
    this.verified_by = null
    this.rejection_reason = null
    await this.save()
  }
}