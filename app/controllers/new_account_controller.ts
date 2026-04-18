// app/controllers/new_account_controller.ts

import User from '#models/user'
import Wallet from '#models/wallet'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'
// ❌ SUPPRIMER CET IMPORT - Le modèle User gère déjà le hashage
// import hash from '@adonisjs/core/services/hash'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class NewAccountController {
  async store({ request, response }: HttpContext) {
    console.log('🟢 [NewAccountController] ===== DÉBUT INSCRIPTION =====')

    try {
      const rawData = request.body()
      console.log('📥 [NewAccountController] Payload reçu:', Object.keys(rawData).length, 'champs')

      // Vérifier email existant
      const existingUser = await User.findBy('email', rawData.email)
      if (existingUser) {
        console.log('❌ [NewAccountController] Email déjà utilisé')
        return response.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
        })
      }

      // ❌ NE PAS HASHER ICI - Le modèle User le fera automatiquement
      // const hashedPassword = await hash.make(rawData.password)
      // console.log('🔐 [NewAccountController] Mot de passe hashé')

      // ✅ Utiliser le mot de passe EN CLAIR - le modèle va le hasher
      const userData: any = {
        // Champs de base
        full_name: rawData.full_name,
        email: rawData.email,
        password: rawData.password, // ⚠️ MOT DE PASSE EN CLAIR
        role: rawData.role || 'client',

        // Localisation
        country: rawData.country || null,
        neighborhood: rawData.neighborhood || null,

        // Étape 1
        birth_date: rawData.birth_date || null,
        id_number: rawData.id_number || null,
        id_front_url: rawData.id_front_url || null,
        id_back_url: rawData.id_back_url || null,
        selfie_url: rawData.selfie_url || null,
        personal_phone: rawData.personal_phone || null,
        residence_address: rawData.residence_address || null,

        // Étape 2
        vendor_type: rawData.vendor_type || null,
        nif_number: rawData.nif_number || null,
        rccm_number: rawData.rccm_number || null,
        rccm_document_url: rawData.rccm_document_url || null,
        commercial_name: rawData.commercial_name || null,
        shop_name: rawData.commercial_name || rawData.shop_name || null,
        whatsapp_phone: rawData.whatsapp_phone || null,
        shop_description: rawData.shop_description || null,
        logo_url: rawData.logo_url || null,
        shop_image: rawData.logo_url || rawData.shop_image || null,
        cover_photo_url: rawData.cover_photo_url || null,

        // Bloc 4 - Boutique physique
        shop_address: rawData.shop_address || null,
        shop_latitude: rawData.shop_latitude || null,
        shop_longitude: rawData.shop_longitude || null,
        facade_photo_1_url: rawData.facade_photo1_url || rawData.facadePhoto1Url || rawData.facade_photo_1_url || null,
        facade_photo_2_url: rawData.facade_photo2_url || rawData.facadePhoto2Url || rawData.facade_photo_2_url || null,
        interior_photo_1_url: rawData.interior_photo1_url || rawData.interiorPhoto1Url || rawData.interior_photo_1_url || null,
        interior_photo_2_url: rawData.interior_photo2_url || rawData.interiorPhoto2Url || rawData.interior_photo_2_url || null,
        seeg_or_lease_url: rawData.seeg_or_lease_url || rawData.seegOrLeaseUrl || null,

        // Bloc 5 - Vendeur en ligne
        stock_address: rawData.stock_address || null,
        address_proof_url: rawData.address_proof_url || null,
        facebook_url: rawData.facebook_url || null,
        instagram_url: rawData.instagram_url || null,
        tiktok_url: rawData.tiktok_url || null,
        stock_video_url: rawData.stock_video_url || null,

        // Étape 3 - Paiement
        payment_method: rawData.payment_method || null,
        airtel_number: rawData.airtel_number || null,
        moov_number: rawData.moov_number || null,
        account_holder_name: rawData.account_holder_name || null,
        bank_name: rawData.bank_name || null,
        rib_document_url: rawData.rib_document_url || null,

        // Validation
        signature: rawData.signature || null,
        certify_truth: true,
        accept_escrow: true,
      }

      // ✅ Références
      if (rawData.reference1) {
        userData.reference_1_name = rawData.reference1.name || null
        userData.reference_1_phone = rawData.reference1.phone || null
        console.log('✅ [NewAccountController] Référence 1:', userData.reference_1_name)
      }

      if (rawData.reference2) {
        userData.reference_2_name = rawData.reference2.name || null
        userData.reference_2_phone = rawData.reference2.phone || null
        console.log('✅ [NewAccountController] Référence 2:', userData.reference_2_name)
      }

      // ✅ Statut marchand
      if (userData.role === 'merchant' || userData.role === 'marchant') {
        userData.verification_status = 'pending'
        userData.is_verified = false
        userData.is_email_verified = false
        userData.is_phone_verified = false
        userData.is_whatsapp_verified = false
        console.log('🏪 [NewAccountController] Compte marchand - statut pending')
      }

      // Nettoyer les champs undefined
      Object.keys(userData).forEach(key => {
        if (userData[key] === undefined) {
          delete userData[key]
        }
      })

      console.log('💾 [NewAccountController] Création utilisateur avec', Object.keys(userData).length, 'champs')
      console.log('🔑 Password avant création:', userData.password ? '******' : 'MANQUANT')

      // ✅ Créer l'utilisateur - le hook @beforeSave va hasher le mot de passe
      const user = await User.create(userData)

      console.log('✅ [NewAccountController] Utilisateur créé avec succès!')
      console.log('  - ID:', user.id)
      console.log('  - Nom:', user.full_name)
      console.log('  - Email:', user.email)
      console.log('  - Rôle:', user.role)

      // Créer wallet si marchand
      let wallet = null
      if (user.role === 'merchant' || user.role === 'marchant') {
        wallet = await Wallet.create({
          user_id: user.id,
          balance: 0,
          currency: 'XAF',
          status: 'active',
        })
        console.log('💰 [NewAccountController] Wallet créé pour le marchand')
      }

      // Générer JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      console.log('🟢 [NewAccountController] ===== FIN INSCRIPTION =====')

      return response.status(201).json({
        success: true,
        message: 'Inscription réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        token,
        ...(wallet && { wallet }),
      })

    } catch (error: any) {
      console.error('💥 [NewAccountController] ERREUR:', error.message)

      if (error.sql) {
        console.error('🗄️ SQL:', error.sqlMessage)
      }

      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'inscription',
        error: error.message,
      })
    }
  }
}
