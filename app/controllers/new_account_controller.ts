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
        
        // Nom de l'entreprise
        company_name: rawData.company_name || null,
        
        // Secteur d'activité (ex: "Distribution alimentaire", "Tech", "Mode", etc.)
        business_sector: rawData.business_sector || null,
        
        // Description des produits vendus
        products_sold: rawData.products_sold || null,
        
        // Type d'activité: 'formel' (entreprise enregistrée) ou 'informel'
        business_type: rawData.business_type || null,
        
        // Téléphone de l'entreprise
        company_phone: rawData.company_phone || null,
        
        // Email professionnel de l'entreprise
        company_email: rawData.company_email || null,
        
        // Adresse physique de l'entreprise
        business_address: rawData.business_address || null,
        
        // 📄 Photo de la fiche d'identification (extrait RCCM, patente, licence)
        // Uniquement pour les entreprises formelles
        business_document_url: rawData.business_document_url || null,

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
        console.log('  - Nom entreprise:', userData.company_name)
        console.log('  - Secteur d\'activité:', userData.business_sector)
        console.log('  - Produits vendus:', userData.products_sold?.substring(0, 100))
        console.log('  - Type:', userData.business_type === 'formel' ? '📋 Formel (entreprise enregistrée)' : '🏠 Informel')
        console.log('  - Téléphone:', userData.company_phone)
        console.log('  - Email pro:', userData.company_email)
        console.log('  - Adresse:', userData.business_address)
        if (userData.business_type === 'formel') {
          console.log('  - 📄 Document fiche:', userData.business_document_url)
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

      return response.status(201).json({
        success: true,
        message: 'Inscription réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          // Informations entreprise
          company_name: user.company_name,
          business_sector: user.business_sector,
          products_sold: user.products_sold,
          business_type: user.business_type,
          company_phone: user.company_phone,
          company_email: user.company_email,
          business_address: user.business_address,
          business_document_url: user.business_document_url,
          verification_status: user.verification_status,
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
