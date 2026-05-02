// app/validators/user.ts
import vine from '@vinejs/vine'

// Validateur qui accepte TOUT - Version corrigée
export const signupValidator = vine.compile(
  vine.object({
    // Champs de base
    full_name: vine.any().optional(),
    email: vine.any().optional(),
    password: vine.any().optional(),
    role: vine.any().optional(),
    phone: vine.any().optional(),
    address: vine.any().optional(),
    country: vine.any().optional(),
    neighborhood: vine.any().optional(),
    avatar: vine.any().optional(),
    
    // Infos personnelles
    birth_date: vine.any().optional(),
    id_number: vine.any().optional(),
    id_front_url: vine.any().optional(),
    id_back_url: vine.any().optional(),
    selfie_url: vine.any().optional(),
    personal_phone: vine.any().optional(),
    residence_address: vine.any().optional(),
    
    // Infos entreprise
    commercial_name: vine.any().optional(),
    shop_name: vine.any().optional(),
    shop_description: vine.any().optional(),
    vendor_type: vine.any().optional(),
    whatsapp_phone: vine.any().optional(),
    shop_address: vine.any().optional(),
    rccm_number: vine.any().optional(),
    rccm_document_url: vine.any().optional(),
    nif_number: vine.any().optional(),
    
    // Paiement
    payment_method: vine.any().optional(),
    airtel_number: vine.any().optional(),
    moov_number: vine.any().optional(),
    account_holder_name: vine.any().optional(),
    bank_name: vine.any().optional(),
    rib_document_url: vine.any().optional(),
    
    // Boutique physique
    shop_latitude: vine.any().optional(),
    shop_longitude: vine.any().optional(),
    facade_photo1_url: vine.any().optional(),
    facade_photo2_url: vine.any().optional(),
    interior_photo1_url: vine.any().optional(),
    interior_photo2_url: vine.any().optional(),
    seeg_or_lease_url: vine.any().optional(),
    
    // Vendeur en ligne
    stock_address: vine.any().optional(),
    address_proof_url: vine.any().optional(),
    facebook_url: vine.any().optional(),
    instagram_url: vine.any().optional(),
    tiktok_url: vine.any().optional(),
    stock_video_url: vine.any().optional(),
    
    // Références
    reference1: vine.any().optional(),
    reference2: vine.any().optional(),
    
    // Autres
    logo_url: vine.any().optional(),
    cover_photo_url: vine.any().optional(),
    signature: vine.any().optional(),
    certify_truth: vine.any().optional(),
    accept_escrow: vine.any().optional(),
  }).allowUnknownProperties() // Permet les propriétés non définies
)

// Login validator permissif
export const loginValidator = vine.compile(
  vine.object({
    email: vine.any().optional(),
    password: vine.any().optional(),
  }).allowUnknownProperties()
)
