// validators/user.ts
import vine from '@vinejs/vine'

export const signupValidator = vine.compile(
  vine.object({
    // ===== CHAMPS DE BASE =====
    full_name: vine.string().trim().minLength(2).maxLength(255),
    email: vine.string().email().trim(),
    password: vine.string().minLength(8),
    role: vine.enum(['client', 'merchant']).optional(),

    // ===== LOCALISATION =====
    country: vine.string().trim().maxLength(10).optional(),
    neighborhood: vine.string().trim().maxLength(255).optional(),

    // ===== ÉTAPE 1 - INFORMATIONS RESPONSABLE =====
    birth_date: vine.string().optional(),  // Accepte "2026-04-02"
    id_number: vine.string().trim().maxLength(100).optional(),
    id_front_url: vine.string().nullable().optional(),
    id_back_url: vine.string().nullable().optional(),
    selfie_url: vine.string().nullable().optional(),
    personal_phone: vine.string().trim().maxLength(20).optional(),
    residence_address: vine.string().trim().maxLength(500).optional(),

    // ===== ÉTAPE 2 - TYPE D'ACTIVITÉ =====
    vendor_type: vine.enum(['boutique_physique', 'vendeur_ligne', 'particulier']).nullable().optional(),
    nif_number: vine.string().trim().maxLength(100).optional(),
    rccm_number: vine.string().trim().maxLength(100).optional(),
    rccm_document_url: vine.string().nullable().optional(),
    commercial_name: vine.string().trim().maxLength(255).optional(),
    whatsapp_phone: vine.string().trim().maxLength(20).optional(),
    shop_description: vine.string().trim().maxLength(1000).optional(),
    logo_url: vine.string().nullable().optional(),
    cover_photo_url: vine.string().nullable().optional(),

    // ===== BLOC 4 - BOUTIQUE PHYSIQUE =====
    shop_address: vine.string().trim().maxLength(500).optional(),
    shop_latitude: vine.number().nullable().optional(),
    shop_longitude: vine.number().nullable().optional(),
    facade_photo1_url: vine.string().nullable().optional(),
    facade_photo2_url: vine.string().nullable().optional(),
    interior_photo1_url: vine.string().nullable().optional(),
    interior_photo2_url: vine.string().nullable().optional(),
    seeg_or_lease_url: vine.string().nullable().optional(),

    // ===== BLOC 5 - VENDEUR EN LIGNE / PARTICULIER =====
    stock_address: vine.string().trim().maxLength(500).optional(),
    address_proof_url: vine.string().nullable().optional(),
    facebook_url: vine.string().trim().maxLength(500).optional(),
    instagram_url: vine.string().trim().maxLength(500).optional(),
    tiktok_url: vine.string().trim().maxLength(500).optional(),
    stock_video_url: vine.string().nullable().optional(),

    // ✅ Accepter les objets reference1 et reference2
    reference1: vine.object({
      name: vine.string().trim().maxLength(255).optional(),
      phone: vine.string().trim().maxLength(20).optional(),
    }).nullable().optional(),

    reference2: vine.object({
      name: vine.string().trim().maxLength(255).optional(),
      phone: vine.string().trim().maxLength(20).optional(),
    }).nullable().optional(),

    // ===== ÉTAPE 3 - PAIEMENT =====
    payment_method: vine.enum(['airtel_money', 'moov_money', 'virement_bancaire']).nullable().optional(),
    airtel_number: vine.string().trim().maxLength(20).optional(),
    moov_number: vine.string().trim().maxLength(20).optional(),
    account_holder_name: vine.string().trim().maxLength(255).optional(),
    bank_name: vine.string().trim().maxLength(255).optional(),
    rib_document_url: vine.string().nullable().optional(),

    // ===== VALIDATION =====
    signature: vine.string().trim().maxLength(255).optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim(),
    password: vine.string(),
  })
)