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
  declare neighborhood: string | null // ✅ Quartier / Ville

  // ============================================================
  // ÉTAPE 1 : INFORMATIONS DU RESPONSABLE (MARCHAND)
  // ============================================================
  
  @column.date()
  declare birth_date: DateTime | null

  @column()
  declare id_number: string | null // Numéro CNI ou Passeport

  @column()
  declare id_front_url: string | null // Photo recto CNI/Passeport

  @column()
  declare id_back_url: string | null // Photo verso CNI/Passeport

  @column()
  declare selfie_url: string | null // Selfie avec CNI

  @column()
  declare personal_phone: string | null // Numéro de téléphone personnel

  @column()
  declare is_phone_verified: boolean // Vérification OTP téléphone

  @column()
  declare is_email_verified: boolean // Vérification OTP email

  @column()
  declare residence_address: string | null // Adresse de résidence actuelle

  // ============================================================
  // ÉTAPE 2 : TYPE D'ACTIVITÉ
  // ============================================================

  @column()
  declare vendor_type: 'boutique_physique' | 'vendeur_ligne' | 'particulier' | null

  @column()
  declare nif_number: string | null

  @column()
  declare rccm_number: string | null

  @column()
  declare rccm_document_url: string | null

  @column()
  declare commercial_name: string | null // Nom commercial

  @column()
  declare shop_name: string | null // Alias pour commercial_name (compatibilité)

  @column()
  declare whatsapp_phone: string | null // WhatsApp Business

  @column()
  declare is_whatsapp_verified: boolean // Vérification OTP WhatsApp

  @column()
  declare shop_description: string | null // Description courte

  @column()
  declare logo_url: string | null

  @column()
  declare shop_image: string | null // Alias pour logo_url (compatibilité)

  @column()
  declare cover_photo_url: string | null // Photo de couverture

  // ============================================================
  // BLOC 4 : BOUTIQUE PHYSIQUE
  // ============================================================

  @column()
  declare shop_address: string | null // Adresse exacte

  @column()
  declare shop_latitude: number | null // Latitude GPS

  @column()
  declare shop_longitude: number | null // Longitude GPS

  @column()
  declare facade_photo1_url: string | null // Photo façade 1 avec enseigne

  @column()
  declare facade_photo2_url: string | null // Photo façade 2 autre angle

  @column()
  declare interior_photo1_url: string | null // Photo intérieur 1 (stock)

  @column()
  declare interior_photo2_url: string | null // Photo intérieur 2

  @column()
  declare seeg_or_lease_url: string | null // Quittance SEEG ou contrat de bail

  // ============================================================
  // BLOC 5 : VENDEUR EN LIGNE / PARTICULIER
  // ============================================================

  @column()
  declare stock_address: string | null // Adresse de stockage

  @column()
  declare address_proof_url: string | null // Preuve d'adresse (SEEG/Facture)

  @column()
  declare facebook_url: string | null

  @column()
  declare instagram_url: string | null

  @column()
  declare tiktok_url: string | null

  @column()
  declare stock_video_url: string | null // Vidéo de 20 secondes du stock

  @column()
  declare reference1_name: string | null // Contact référence 1 - Nom

  @column()
  declare reference1_phone: string | null // Contact référence 1 - Téléphone

  @column()
  declare reference2_name: string | null // Contact référence 2 - Nom

  @column()
  declare reference2_phone: string | null // Contact référence 2 - Téléphone

  // ============================================================
  // ÉTAPE 3 : PAIEMENT ET VALIDATION
  // ============================================================

  @column()
  declare payment_method: 'airtel_money' | 'moov_money' | 'virement_bancaire' | null

  @column()
  declare airtel_number: string | null

  @column()
  declare moov_number: string | null

  @column()
  declare account_holder_name: string | null // Nom du titulaire Mobile Money

  @column()
  declare bank_name: string | null

  @column()
  declare rib_document_url: string | null // RIB pour virement bancaire

  // ============================================================
  // VALIDATION ET ENGAGEMENT
  // ============================================================

  @column()
  declare certify_truth: boolean // Certification sur l'honneur

  @column()
  declare accept_escrow: boolean // Acceptation du séquestre

  @column()
  declare signature: string | null // Signature électronique

  // ============================================================
  // STATUT DE VÉRIFICATION
  // ============================================================

  @column()
  declare is_verified: boolean // Compte vérifié complètement

  @column()
  declare verification_status: 'pending' | 'approved' | 'rejected' | null // Statut de vérification

  @column()
  declare verified_at: DateTime | null // Date de vérification

  @column()
  declare verified_by: string | null // ID de l'admin qui a vérifié

  @column()
  declare rejection_reason: string | null // Raison du rejet

  // ============================================================
  // TIMESTAMPS
  // ============================================================

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
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
    // Valeurs par défaut pour les booléens
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

  // ✅ Vérifie si le marchand a complété toutes les étapes
  get hasCompletedRegistration(): boolean {
    if (!this.isMerchant) return true
    
    // Vérification des champs obligatoires de l'étape 1
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
    
    // Vérification des champs obligatoires de l'étape 2
    const step2Complete = !!(
      this.vendor_type &&
      this.commercial_name &&
      this.is_whatsapp_verified &&
      this.shop_description
    )
    
    // Vérification spécifique selon le type de vendeur
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
    
    // Vérification des champs obligatoires de l'étape 3
    const step3Complete = !!(
      this.payment_method &&
      this.certify_truth &&
      this.accept_escrow &&
      this.signature
    )
    
    // Vérification spécifique du moyen de paiement
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

  // ✅ Type de boutique affiché en français
  get vendorTypeLabel(): string | null {
    const labels = {
      'boutique_physique': 'Boutique physique',
      'vendeur_ligne': 'Vendeur en ligne',
      'particulier': 'Particulier',
    }
    return this.vendor_type ? labels[this.vendor_type] : null
  }

  // ✅ Statut de vérification affiché en français
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

  /**
   * Marquer le compte comme vérifié
   */
  async approve(adminId: string): Promise<void> {
    this.is_verified = true
    this.verification_status = 'approved'
    this.verified_at = DateTime.now()
    this.verified_by = adminId
    this.rejection_reason = null
    await this.save()
  }

  /**
   * Rejeter la vérification du compte
   */
  async reject(adminId: string, reason: string): Promise<void> {
    this.is_verified = false
    this.verification_status = 'rejected'
    this.verified_at = DateTime.now()
    this.verified_by = adminId
    this.rejection_reason = reason
    await this.save()
  }

  /**
   * Mettre en attente de vérification
   */
  async pending(): Promise<void> {
    this.is_verified = false
    this.verification_status = 'pending'
    this.verified_at = null
    this.verified_by = null
    this.rejection_reason = null
    await this.save()
  }
}
