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
      // Accepter TOUTES les données sans validation
      const rawData = request.body()
      
      // Log complet de tout ce qui est reçu
      console.log('📥 [NewAccountController] Données brutes reçues:')
      console.log(JSON.stringify(rawData, null, 2))

      // Vérifier email si présent
      if (rawData.email) {
        const existingUser = await User.findBy('email', rawData.email)
        if (existingUser) {
          console.log('❌ [NewAccountController] Email déjà utilisé')
          return response.status(400).json({
            success: false,
            message: 'Cet email est déjà utilisé',
          })
        }
      }

      // Déterminer le rôle (accepter toutes les variantes)
      let role = 'client' // Par défaut
      if (rawData.role) {
        const lowerRole = rawData.role.toLowerCase()
        if (lowerRole === 'merchant' || lowerRole === 'marchant' || lowerRole === 'marchand') {
          role = 'merchant'
        } else if (lowerRole === 'admin') {
          role = 'admin'
        }
      }

      const isMerchant = role === 'merchant'

      // ============================================================
      // CONSTRUCTION DES DONNÉES UTILISATEUR
      // ============================================================
      const userData: Record<string, any> = {
        // ========================================================
        // CHAMPS DE BASE
        // ========================================================
        full_name: rawData.full_name || rawData.name || rawData.username || '',
        email: rawData.email || '',
        password: rawData.password || '',
        role: role,
        phone: rawData.phone || rawData.personal_phone || rawData.telephone || rawData.tel || null,
        address: rawData.address || rawData.residence_address || rawData.adresse || null,
        country: rawData.country || rawData.pays || null,
        neighborhood: rawData.neighborhood || rawData.quartier || null,
        avatar: rawData.avatar || rawData.selfie_url || rawData.profile_picture || rawData.photo || null,

        // ========================================================
        // INFORMATIONS PERSONNELLES
        // ========================================================
        birth_date: rawData.birth_date || rawData.date_naissance || rawData.birthdate || rawData.date_of_birth || null,
        id_number: rawData.id_number || rawData.numero_piece || rawData.id_card_number || null,
        id_front_url: rawData.id_front_url || rawData.id_front || rawData.cni_recto || null,
        id_back_url: rawData.id_back_url || rawData.id_back || rawData.cni_verso || null,
        selfie_url: rawData.selfie_url || rawData.selfie || rawData.photo_selfie || null,
        personal_phone: rawData.personal_phone || rawData.phone || rawData.telephone || null,
        residence_address: rawData.residence_address || rawData.address || rawData.adresse || null,
        is_phone_verified: rawData.is_phone_verified || false,
        is_email_verified: rawData.is_email_verified || false,

        // ========================================================
        // INFORMATIONS ENTREPRISE (MARCHAND)
        // ========================================================
        commercial_name: rawData.commercial_name || rawData.company_name || rawData.business_name || 
                         rawData.nom_commercial || rawData.nom_entreprise || null,
        shop_name: rawData.shop_name || rawData.boutique_name || rawData.store_name || 
                   rawData.company_name || rawData.nom_boutique || null,
        shop_description: rawData.shop_description || rawData.products_sold || rawData.description || 
                          rawData.produits_vendus || null,
        vendor_type: rawData.vendor_type || rawData.business_type || rawData.type_vendeur || 
                     rawData.seller_type || null,
        whatsapp_phone: rawData.whatsapp_phone || rawData.company_phone || rawData.whatsapp || 
                        rawData.phone_whatsapp || null,
        is_whatsapp_verified: rawData.is_whatsapp_verified || false,
        shop_address: rawData.shop_address || rawData.business_address || rawData.adresse_boutique || null,
        rccm_number: rawData.rccm_number || rawData.rccm || rawData.registre_commerce || null,
        rccm_document_url: rawData.rccm_document_url || rawData.business_document_url || 
                           rawData.document_rccm || null,
        nif_number: rawData.nif_number || rawData.nif || rawData.numero_fiscal || null,

        // ========================================================
        // INFORMATIONS BANCAIRES
        // ========================================================
        payment_method: rawData.payment_method || rawData.methode_paiement || null,
        airtel_number: rawData.airtel_number || rawData.airtel || rawData.numero_airtel || null,
        moov_number: rawData.moov_number || rawData.moov || rawData.numero_moov || null,
        account_holder_name: rawData.account_holder_name || rawData.titulaire_compte || 
                             rawData.nom_titulaire || null,
        bank_name: rawData.bank_name || rawData.banque || rawData.nom_banque || null,
        rib_document_url: rawData.rib_document_url || rawData.rib || rawData.releve_bancaire || null,

        // ========================================================
        // BOUTIQUE PHYSIQUE
        // ========================================================
        shop_latitude: rawData.shop_latitude || rawData.latitude || null,
        shop_longitude: rawData.shop_longitude || rawData.longitude || null,
        facade_photo1_url: rawData.facade_photo1_url || rawData.facade_photo1 || null,
        facade_photo2_url: rawData.facade_photo2_url || rawData.facade_photo2 || null,
        interior_photo1_url: rawData.interior_photo1_url || rawData.interior_photo1 || null,
        interior_photo2_url: rawData.interior_photo2_url || rawData.interior_photo2 || null,
        seeg_or_lease_url: rawData.seeg_or_lease_url || rawData.seeg_lease || null,

        // ========================================================
        // VENDEUR EN LIGNE
        // ========================================================
        stock_address: rawData.stock_address || rawData.adresse_stock || null,
        address_proof_url: rawData.address_proof_url || rawData.preuve_adresse || null,
        facebook_url: rawData.facebook_url || rawData.facebook || null,
        instagram_url: rawData.instagram_url || rawData.instagram || null,
        tiktok_url: rawData.tiktok_url || rawData.tiktok || null,
        stock_video_url: rawData.stock_video_url || rawData.video_stock || null,

        // ========================================================
        // RÉFÉRENCES
        // ========================================================
        reference1: rawData.reference1 || null,
        reference2: rawData.reference2 || null,

        // ========================================================
        // AUTRES
        // ========================================================
        logo_url: rawData.logo_url || rawData.logo || null,
        cover_photo_url: rawData.cover_photo_url || rawData.cover || rawData.banniere || null,
        signature: rawData.signature || null,
        certify_truth: rawData.certify_truth !== undefined ? rawData.certify_truth : true,
        accept_escrow: rawData.accept_escrow !== undefined ? rawData.accept_escrow : true,
      }

      // Ajouter TOUS les autres champs qui pourraient exister
      const knownFields = Object.keys(userData)
      for (const key in rawData) {
        if (!knownFields.includes(key)) {
          userData[key] = rawData[key]
          console.log(`➕ [NewAccountController] Champ supplémentaire ajouté: ${key} = ${rawData[key]}`)
        }
      }

      // Statut marchand
      if (isMerchant) {
        userData.verification_status = userData.verification_status || 'pending'
        userData.is_verified = userData.is_verified !== undefined ? userData.is_verified : false
        console.log('🏪 [NewAccountController] Compte marchand - statut:', userData.verification_status)
      } else {
        userData.verification_status = userData.verification_status || 'approved'
        userData.is_verified = userData.is_verified !== undefined ? userData.is_verified : true
      }

      // Nettoyer les champs undefined et null
      Object.keys(userData).forEach(key => {
        if (userData[key] === undefined || userData[key] === '') {
          delete userData[key]
        }
      })

      // S'assurer que les champs requis ne sont pas vides
      if (!userData.full_name) {
        userData.full_name = 'Utilisateur'
        console.log('⚠️ [NewAccountController] full_name manquant, valeur par défaut utilisée')
      }
      if (!userData.email) {
        return response.status(400).json({
          success: false,
          message: 'Email requis',
        })
      }
      if (!userData.password) {
        userData.password = Math.random().toString(36).slice(-8)
        console.log('⚠️ [NewAccountController] password manquant, mot de passe aléatoire généré')
      }

      console.log('💾 [NewAccountController] Création utilisateur avec', Object.keys(userData).length, 'champs')
      console.log('📋 Champs:', Object.keys(userData).join(', '))

      // Créer l'utilisateur
      const user = await User.create(userData)

      console.log('✅ [NewAccountController] Utilisateur créé avec succès!')
      console.log('  - ID:', user.id)
      console.log('  - Nom:', user.full_name)
      console.log('  - Email:', user.email)
      console.log('  - Rôle:', user.role)
      console.log('  - Statut vérification:', user.verification_status)

      // Créer wallet si marchand
      let wallet = null
      if (isMerchant) {
        try {
          wallet = await Wallet.create({
            user_id: user.id,
            balance: 0,
            currency: 'XAF',
            status: 'active',
          })
          console.log('💰 [NewAccountController] Wallet créé pour le marchand')
        } catch (walletError: unknown) {
          // Correction: Typage explicite de l'erreur
          const error = walletError as Error
          console.error('⚠️ [NewAccountController] Erreur création wallet:', error.message)
          // Continuer même si le wallet échoue
        }
      }

      // Générer JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      console.log('🟢 [NewAccountController] ===== FIN INSCRIPTION =====')

      // Construction de la réponse complète
      const userResponse: Record<string, any> = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        verification_status: user.verification_status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      }

      // Ajouter tous les champs non vides de l'utilisateur
      // Correction: Utilisation de (user as any) pour l'accès dynamique
      const userAny = user as any
      const userFields = [
        'phone', 'address', 'country', 'neighborhood', 'avatar',
        'birth_date', 'id_number', 'personal_phone', 'residence_address',
        'commercial_name', 'shop_name', 'shop_description', 'vendor_type',
        'whatsapp_phone', 'shop_address', 'rccm_number', 'nif_number',
        'payment_method', 'airtel_number', 'moov_number', 'account_holder_name',
        'bank_name', 'shop_latitude', 'shop_longitude', 'facebook_url',
        'instagram_url', 'tiktok_url', 'logo_url', 'cover_photo_url'
      ]

      userFields.forEach(field => {
        if (userAny[field]) {
          userResponse[field] = userAny[field]
        }
      })

      const responseData: Record<string, any> = {
        success: true,
        message: 'Inscription réussie',
        user: userResponse,
        token,
      }

      if (wallet) {
        responseData.wallet = {
          id: wallet.id,
          balance: wallet.balance,
          currency: wallet.currency,
        }
      }

      return response.status(201).json(responseData)

    } catch (error: unknown) {
      // Correction: Typage explicite de l'erreur
      const err = error as any
      console.error('💥 [NewAccountController] ERREUR:', err.message)
      console.error('💥 Stack:', err.stack)

      if (err.sql) {
        console.error('🗄️ SQL Error:', err.sqlMessage)
        console.error('🗄️ SQL Query:', err.sql)
      }

      // Déterminer le code d'erreur approprié
      let statusCode = 400
      let errorMessage = 'Erreur lors de l\'inscription'

      if (err.code === 'ER_DUP_ENTRY') {
        errorMessage = 'Cet email ou numéro de téléphone existe déjà'
        statusCode = 409
      } else if (err.code === 'ER_BAD_FIELD_ERROR') {
        errorMessage = 'Champ de base de données invalide'
        console.error('🗄️ Champ invalide détecté - vérifiez les colonnes de la table users')
      }

      return response.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? err.message : 'Erreur serveur',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      })
    }
  }
}
