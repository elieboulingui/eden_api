// database/migrations/xxxx_update_user_fields.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    // ============================================================
    // ÉTAPE 1 : INFORMATIONS DU RESPONSABLE (MARCHAND)
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      // Date de naissance
      table.date('birth_date').nullable()

      // Numéro CNI ou Passeport
      table.string('id_number').nullable()

      // Photos CNI et selfie
      table.text('id_front_url').nullable()
      table.text('id_back_url').nullable()
      table.text('selfie_url').nullable()

      // Téléphone personnel
      table.string('personal_phone').nullable()

      // Vérifications OTP
      table.boolean('is_phone_verified').defaultTo(false)
      table.boolean('is_email_verified').defaultTo(false)

      // Adresse de résidence
      table.text('residence_address').nullable()

      // Quartier / Ville
      table.string('neighborhood').nullable()
    })

    // ============================================================
    // ÉTAPE 2 : TYPE D'ACTIVITÉ
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      // Type de vendeur
      table.enum('vendor_type', ['boutique_physique', 'vendeur_ligne', 'particulier'])
        .nullable()

      // Documents professionnels
      table.string('nif_number').nullable()
      table.string('rccm_number').nullable()
      table.text('rccm_document_url').nullable()

      // Nom commercial
      table.string('commercial_name').nullable()

      // WhatsApp Business
      table.string('whatsapp_phone').nullable()
      table.boolean('is_whatsapp_verified').defaultTo(false)

      // Description
      table.text('shop_description').nullable()

      // Images boutique
      table.text('logo_url').nullable()
      table.text('cover_photo_url').nullable()
    })

    // ============================================================
    // BLOC 4 : BOUTIQUE PHYSIQUE
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      // Adresse et GPS
      table.text('shop_address').nullable()
      table.decimal('shop_latitude', 10, 8).nullable()
      table.decimal('shop_longitude', 11, 8).nullable()

      // Photos boutique physique
      table.text('facade_photo1_url').nullable()
      table.text('facade_photo2_url').nullable()
      table.text('interior_photo1_url').nullable()
      table.text('interior_photo2_url').nullable()

      // Document SEEG ou bail
      table.text('seeg_or_lease_url').nullable()
    })

    // ============================================================
    // BLOC 5 : VENDEUR EN LIGNE / PARTICULIER
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      // Adresse de stockage
      table.text('stock_address').nullable()

      // Preuve d'adresse
      table.text('address_proof_url').nullable()

      // Réseaux sociaux
      table.text('facebook_url').nullable()
      table.text('instagram_url').nullable()
      table.text('tiktok_url').nullable()

      // Vidéo du stock
      table.text('stock_video_url').nullable()

      // Contacts de référence
      table.string('reference1_name').nullable()
      table.string('reference1_phone').nullable()
      table.string('reference2_name').nullable()
      table.string('reference2_phone').nullable()
    })

    // ============================================================
    // ÉTAPE 3 : PAIEMENT ET VALIDATION
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      // Moyen de paiement
      table.enum('payment_method', ['airtel_money', 'moov_money', 'virement_bancaire'])
        .nullable()

      // Numéros Mobile Money
      table.string('airtel_number').nullable()
      table.string('moov_number').nullable()

      // Titulaire du compte
      table.string('account_holder_name').nullable()

      // Informations bancaires
      table.string('bank_name').nullable()
      table.text('rib_document_url').nullable()
    })

    // ============================================================
    // VALIDATION ET ENGAGEMENT
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      // Certifications
      table.boolean('certify_truth').defaultTo(false)
      table.boolean('accept_escrow').defaultTo(false)

      // Signature électronique
      table.string('signature').nullable()
    })

    // ============================================================
    // STATUT DE VÉRIFICATION
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      // Vérification complète
      table.boolean('is_verified').defaultTo(false)

      // Statut de vérification
      table.enum('verification_status', ['pending', 'approved', 'rejected'])
        .defaultTo('pending')
        .nullable()

      // Date de vérification
      table.dateTime('verified_at').nullable()

      // Admin qui a vérifié
      table.string('verified_by').nullable()

      // Raison du rejet
      table.text('rejection_reason').nullable()
    })
  }

  async down() {
    // ============================================================
    // SUPPRESSION DES CHAMPS - ÉTAPE 1
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('birth_date')
      table.dropColumn('id_number')
      table.dropColumn('id_front_url')
      table.dropColumn('id_back_url')
      table.dropColumn('selfie_url')
      table.dropColumn('personal_phone')
      table.dropColumn('is_phone_verified')
      table.dropColumn('is_email_verified')
      table.dropColumn('residence_address')
      table.dropColumn('neighborhood')
    })

    // ============================================================
    // SUPPRESSION DES CHAMPS - ÉTAPE 2
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('vendor_type')
      table.dropColumn('nif_number')
      table.dropColumn('rccm_number')
      table.dropColumn('rccm_document_url')
      table.dropColumn('commercial_name')
      table.dropColumn('whatsapp_phone')
      table.dropColumn('is_whatsapp_verified')
      table.dropColumn('shop_description')
      table.dropColumn('logo_url')
      table.dropColumn('cover_photo_url')
    })

    // ============================================================
    // SUPPRESSION DES CHAMPS - BLOC 4
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('shop_address')
      table.dropColumn('shop_latitude')
      table.dropColumn('shop_longitude')
      table.dropColumn('facade_photo1_url')
      table.dropColumn('facade_photo2_url')
      table.dropColumn('interior_photo1_url')
      table.dropColumn('interior_photo2_url')
      table.dropColumn('seeg_or_lease_url')
    })

    // ============================================================
    // SUPPRESSION DES CHAMPS - BLOC 5
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('stock_address')
      table.dropColumn('address_proof_url')
      table.dropColumn('facebook_url')
      table.dropColumn('instagram_url')
      table.dropColumn('tiktok_url')
      table.dropColumn('stock_video_url')
      table.dropColumn('reference1_name')
      table.dropColumn('reference1_phone')
      table.dropColumn('reference2_name')
      table.dropColumn('reference2_phone')
    })

    // ============================================================
    // SUPPRESSION DES CHAMPS - ÉTAPE 3
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('payment_method')
      table.dropColumn('airtel_number')
      table.dropColumn('moov_number')
      table.dropColumn('account_holder_name')
      table.dropColumn('bank_name')
      table.dropColumn('rib_document_url')
    })

    // ============================================================
    // SUPPRESSION DES CHAMPS - VALIDATION
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('certify_truth')
      table.dropColumn('accept_escrow')
      table.dropColumn('signature')
    })

    // ============================================================
    // SUPPRESSION DES CHAMPS - STATUT DE VÉRIFICATION
    // ============================================================

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_verified')
      table.dropColumn('verification_status')
      table.dropColumn('verified_at')
      table.dropColumn('verified_by')
      table.dropColumn('rejection_reason')
    })
  }
}
