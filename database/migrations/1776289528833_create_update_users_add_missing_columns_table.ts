// database/migrations/xxxx_update_users_add_missing_columns.ts

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    // Récupérer les colonnes existantes pour éviter les doublons
    const columns = await this.db.rawQuery(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `)

    const existingColumns = columns.rows.map((row: any) => row.column_name)
    console.log('📋 Colonnes existantes:', existingColumns.length)

    this.schema.alterTable(this.tableName, (table) => {
      // Étape 1 - Infos responsable
      if (!existingColumns.includes('birth_date')) {
        table.date('birth_date').nullable()
      }
      if (!existingColumns.includes('id_number')) {
        table.string('id_number').nullable()
      }
      if (!existingColumns.includes('id_front_url')) {
        table.string('id_front_url').nullable()
      }
      if (!existingColumns.includes('id_back_url')) {
        table.string('id_back_url').nullable()
      }
      if (!existingColumns.includes('selfie_url')) {
        table.string('selfie_url').nullable()
      }
      if (!existingColumns.includes('personal_phone')) {
        table.string('personal_phone').nullable()
      }
      if (!existingColumns.includes('is_phone_verified')) {
        table.boolean('is_phone_verified').defaultTo(false)
      }
      if (!existingColumns.includes('is_email_verified')) {
        table.boolean('is_email_verified').defaultTo(false)
      }
      if (!existingColumns.includes('residence_address')) {
        table.text('residence_address').nullable()
      }

      // Étape 2 - Type d'activité
      if (!existingColumns.includes('vendor_type')) {
        table.enum('vendor_type', ['boutique_physique', 'vendeur_ligne', 'particulier']).nullable()
      }
      if (!existingColumns.includes('nif_number')) {
        table.string('nif_number').nullable()
      }
      if (!existingColumns.includes('rccm_number')) {
        table.string('rccm_number').nullable()
      }
      if (!existingColumns.includes('rccm_document_url')) {
        table.string('rccm_document_url').nullable()
      }
      if (!existingColumns.includes('commercial_name')) {
        table.string('commercial_name').nullable()
      }
      if (!existingColumns.includes('shop_name')) {
        table.string('shop_name').nullable()
      }
      if (!existingColumns.includes('whatsapp_phone')) {
        table.string('whatsapp_phone').nullable()
      }
      if (!existingColumns.includes('is_whatsapp_verified')) {
        table.boolean('is_whatsapp_verified').defaultTo(false)
      }
      if (!existingColumns.includes('shop_description')) {
        table.text('shop_description').nullable()
      }
      if (!existingColumns.includes('logo_url')) {
        table.string('logo_url').nullable()
      }
      if (!existingColumns.includes('shop_image')) {
        table.string('shop_image').nullable()
      }
      if (!existingColumns.includes('cover_photo_url')) {
        table.string('cover_photo_url').nullable()
      }

      // Bloc 4 - Boutique physique
      if (!existingColumns.includes('shop_address')) {
        table.text('shop_address').nullable()
      }
      if (!existingColumns.includes('shop_latitude')) {
        table.decimal('shop_latitude', 10, 8).nullable()
      }
      if (!existingColumns.includes('shop_longitude')) {
        table.decimal('shop_longitude', 11, 8).nullable()
      }
      if (!existingColumns.includes('facade_photo_1_url')) {
        table.string('facade_photo_1_url').nullable()
      }
      if (!existingColumns.includes('facade_photo_2_url')) {
        table.string('facade_photo_2_url').nullable()
      }
      if (!existingColumns.includes('interior_photo_1_url')) {
        table.string('interior_photo_1_url').nullable()
      }
      if (!existingColumns.includes('interior_photo_2_url')) {
        table.string('interior_photo_2_url').nullable()
      }
      if (!existingColumns.includes('seeg_or_lease_url')) {
        table.string('seeg_or_lease_url').nullable()
      }

      // Bloc 5 - Vendeur en ligne
      if (!existingColumns.includes('stock_address')) {
        table.text('stock_address').nullable()
      }
      if (!existingColumns.includes('address_proof_url')) {
        table.string('address_proof_url').nullable()
      }
      if (!existingColumns.includes('facebook_url')) {
        table.string('facebook_url').nullable()
      }
      if (!existingColumns.includes('instagram_url')) {
        table.string('instagram_url').nullable()
      }
      if (!existingColumns.includes('tiktok_url')) {
        table.string('tiktok_url').nullable()
      }
      if (!existingColumns.includes('stock_video_url')) {
        table.string('stock_video_url').nullable()
      }
      if (!existingColumns.includes('reference_1_name')) {
        table.string('reference_1_name').nullable()
      }
      if (!existingColumns.includes('reference_1_phone')) {
        table.string('reference_1_phone').nullable()
      }
      if (!existingColumns.includes('reference_2_name')) {
        table.string('reference_2_name').nullable()
      }
      if (!existingColumns.includes('reference_2_phone')) {
        table.string('reference_2_phone').nullable()
      }

      // Étape 3 - Paiement
      if (!existingColumns.includes('payment_method')) {
        table.enum('payment_method', ['airtel_money', 'moov_money', 'virement_bancaire']).nullable()
      }
      if (!existingColumns.includes('airtel_number')) {
        table.string('airtel_number').nullable()
      }
      if (!existingColumns.includes('moov_number')) {
        table.string('moov_number').nullable()
      }
      if (!existingColumns.includes('account_holder_name')) {
        table.string('account_holder_name').nullable()
      }
      if (!existingColumns.includes('bank_name')) {
        table.string('bank_name').nullable()
      }
      if (!existingColumns.includes('rib_document_url')) {
        table.string('rib_document_url').nullable()
      }

      // Validation
      if (!existingColumns.includes('certify_truth')) {
        table.boolean('certify_truth').defaultTo(false)
      }
      if (!existingColumns.includes('accept_escrow')) {
        table.boolean('accept_escrow').defaultTo(false)
      }
      if (!existingColumns.includes('signature')) {
        table.string('signature').nullable()
      }

      // Statut vérification
      if (!existingColumns.includes('is_verified')) {
        table.boolean('is_verified').defaultTo(false)
      }
      if (!existingColumns.includes('verification_status')) {
        table.enum('verification_status', ['pending', 'approved', 'rejected']).defaultTo('pending')
      }
      if (!existingColumns.includes('verified_at')) {
        table.dateTime('verified_at').nullable()
      }
      if (!existingColumns.includes('verified_by')) {
        table.string('verified_by').nullable()
      }
      if (!existingColumns.includes('rejection_reason')) {
        table.text('rejection_reason').nullable()
      }
    })

    console.log('✅ Migration terminée avec succès!')
  }

  async down() {
    // On ne supprime rien dans le down pour éviter de perdre des données
    console.log('⚠️ Down migration: aucune colonne supprimée pour éviter la perte de données')
  }
}