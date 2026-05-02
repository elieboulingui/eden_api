// app/controllers/new_account_controller.ts
import User from '#models/user'
import Wallet from '#models/wallet'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

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

      // Déterminer le rôle
      const isMerchant = rawData.role === 'merchant' || rawData.role === 'marchant'
      const role = isMerchant ? 'merchant' : (rawData.role || 'client')

      // ============================================================
      // CONSTRUCTION DES DONNÉES UTILISATEUR
      // ============================================================
      const userData: any = {
        // ========================================================
        // CHAMPS DE BASE
        // ========================================================
        full_name: rawData.full_name,
        email: rawData.email,
        password: rawData.password,
        role: role,
        phone: rawData.phone || rawData.personal_phone || null,
        address: rawData.address || rawData.residence_address || null,
        country: rawData.country || null,
        neighborhood: rawData.neighborhood || null,
        avatar: rawData.avatar || rawData.selfie_url || null,

        // ========================================================
        // INFORMATIONS PERSONNELLES (RESPONSABLE)
        // ========================================================
        birth_date: rawData.birth_date || null,
        id_number: rawData.id_number || null,
        id_front_url: rawData.id_front_url || null,
        id_back_url: rawData.id_back_url || null,
        selfie_url: rawData.selfie_url || null,
        personal_phone: rawData.personal_phone || rawData.phone || null,
        residence_address: rawData.residence_address || rawData.address || null,
        is_phone_verified: rawData.is_phone_verified || false,
        is_email_verified: rawData.is_email_verified || false,

        // ========================================================
        // 🏢 INFORMATIONS DE L'ENTREPRISE (MARCHAND)
        // ========================================================
        // ✅ Utilisation des colonnes EXISTANTES du modèle User
        
        // Nom commercial de l'entreprise
        commercial_name: rawData.company_name || rawData.commercial_name || null,
        
        // Nom de la boutique
        shop_name: rawData.shop_name || rawData.company_name || null,
        
        // Description de la boutique / produits vendus
        shop_description: rawData.products_sold || rawData.shop_description || null,
        
        // Type de vendeur (converti depuis business_type)
        // business_type 'formel' -> 'boutique_physique'
        // business_type 'informel' -> 'vendeur_ligne'
        vendor_type: rawData.business_type === 'formel' 
          ? 'boutique_physique' 
          : (rawData.business_type === 'informel' ? 'vendeur_ligne' : rawData.vendor_type || null),
        
        // Téléphone WhatsApp pour l'entreprise
        whatsapp_phone: rawData.company_phone || rawData.whatsapp_phone || null,
        is_whatsapp_verified: rawData.is_whatsapp_verified || false,
        
        // Adresse de la boutique
        shop_address: rawData.business_address || rawData.shop_address || null,
        
        // Documents d'identification de l'entreprise
        rccm_number: rawData.rccm_number || null,
        rccm_document_url: rawData.business_document_url || rawData.rccm_document_url || null,
        nif_number: rawData.nif_number || null,

        // ========================================================
        // INFORMATIONS BANCAIRES (PAIEMENT)
        // ========================================================
        payment_method: rawData.payment_method || null,
        airtel_number: rawData.airtel_number || null,
        moov_number: rawData.moov_number || null,
        account_holder_name: rawData.account_holder_name || null,
        bank_name: rawData.bank_name || null,
        rib_document_url: rawData.rib_document_url || null,

        // ========================================================
        // VALIDATION ET ENGAGEMENT
        // ========================================================
        signature: rawData.signature || null,
        certify_truth: rawData.certify_truth !== undefined ? rawData.certify_truth : true,
        accept_escrow: rawData.accept_escrow !== undefined ? rawData.accept_escrow : true,
      }

      // Log des informations de l'entreprise
      if (isMerchant) {
        console.log('🏢 [NewAccountController] ===== INFORMATIONS ENTREPRISE =====')
        console.log('  - Nom commercial:', userData.commercial_name)
        console.log('  - Nom boutique:', userData.shop_name)
        console.log('  - Description:', userData.shop_description?.substring(0, 100))
        console.log('  - Type vendeur:', userData.vendor_type)
        console.log('  - WhatsApp:', userData.whatsapp_phone)
        console.log('  - Adresse boutique:', userData.shop_address)
        if (userData.rccm_document_url) {
          console.log('  - 📄 Document RCCM:', userData.rccm_document_url)
        }
        if (userData.rccm_number) {
          console.log('  - Numéro RCCM:', userData.rccm_number)
        }
        if (userData.nif_number) {
          console.log('  - NIF:', userData.nif_number)
        }
        console.log('=============================================')
      }

      // ✅ Statut marchand
      if (isMerchant) {
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

      // ✅ Créer l'utilisateur
      const user = await User.create(userData)

      console.log('✅ [NewAccountController] Utilisateur créé avec succès!')
      console.log('  - ID:', user.id)
      console.log('  - Nom:', user.full_name)
      console.log('  - Email:', user.email)
      console.log('  - Rôle:', user.role)

      // Créer wallet si marchand
      let wallet = null
      if (isMerchant) {
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

      // Construction de la réponse avec les champs existants
      const userResponse: any = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        verification_status: user.verification_status,
      }

      // Ajouter les champs entreprise s'ils existent (utilisant les colonnes du modèle)
      if (user.commercial_name) userResponse.commercial_name = user.commercial_name
      if (user.shop_name) userResponse.shop_name = user.shop_name
      if (user.shop_description) userResponse.shop_description = user.shop_description
      if (user.vendor_type) userResponse.vendor_type = user.vendor_type
      if (user.whatsapp_phone) userResponse.whatsapp_phone = user.whatsapp_phone
      if (user.shop_address) userResponse.shop_address = user.shop_address
      if (user.rccm_number) userResponse.rccm_number = user.rccm_number
      if (user.nif_number) userResponse.nif_number = user.nif_number

      return response.status(201).json({
        success: true,
        message: 'Inscription réussie',
        user: userResponse,
        token,
        ...(wallet && { wallet: { id: wallet.id, balance: wallet.balance, currency: wallet.currency } }),
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
