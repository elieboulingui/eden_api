import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'

export default class ClientController {

  /**
   * Inscription d'un utilisateur (client ou marchand)
   */
  async register({ request, response }: HttpContext) {
    console.log('📝 [ClientController] ===== DÉBUT INSCRIPTION =====')
    console.log('📋 [ClientController] Headers:', request.headers())
    console.log('📋 [ClientController] Method:', request.method())
    console.log('📋 [ClientController] URL:', request.url())

    try {
      // Récupérer TOUTES les données brutes
      const allData = request.all()
      console.log('📦 [ClientController] Données brutes reçues:', JSON.stringify(allData, null, 2))

      // Vérifier les champs importants
      console.log('🔍 [ClientController] Vérification champs clés:')
      console.log('  - full_name:', allData.full_name || '❌ MANQUANT')
      console.log('  - email:', allData.email || '❌ MANQUANT')
      console.log('  - password:', allData.password ? '✅ Présent' : '❌ MANQUANT')
      console.log('  - role:', allData.role || '❌ MANQUANT')
      console.log('  - country:', allData.country || '❌ MANQUANT')
      console.log('  - neighborhood:', allData.neighborhood || '❌ MANQUANT')
      console.log('  - birth_date:', allData.birth_date || '❌ MANQUANT')
      console.log('  - id_number:', allData.id_number || '❌ MANQUANT')
      console.log('  - id_front_url:', allData.id_front_url || '❌ MANQUANT')
      console.log('  - vendor_type:', allData.vendor_type || '❌ MANQUANT')
      console.log('  - commercial_name:', allData.commercial_name || '❌ MANQUANT')

      // Filtrer les champs autorisés
      const data = request.only([
        // Champs de base
        'full_name',
        'email',
        'password',
        'role',
        'country',
        'neighborhood',

        // Étape 1 - Infos responsables
        'birth_date',
        'id_number',
        'id_front_url',
        'id_back_url',
        'selfie_url',
        'personal_phone',
        'is_phone_verified',
        'is_email_verified',
        'residence_address',

        // Étape 2 - Type d'activité
        'vendor_type',
        'nif_number',
        'rccm_number',
        'rccm_document_url',
        'commercial_name',
        'shop_name',
        'whatsapp_phone',
        'is_whatsapp_verified',
        'shop_description',
        'logo_url',
        'shop_image',
        'cover_photo_url',

        // Bloc 4 - Boutique physique
        'shop_address',
        'shop_latitude',
        'shop_longitude',
        'facade_photo1_url',
        'facade_photo2_url',
        'interior_photo1_url',
        'interior_photo2_url',
        'seeg_or_lease_url',

        // Bloc 5 - Vendeur en ligne
        'stock_address',
        'address_proof_url',
        'facebook_url',
        'instagram_url',
        'tiktok_url',
        'stock_video_url',
        'reference1_name',
        'reference1_phone',
        'reference2_name',
        'reference2_phone',

        // Étape 3 - Paiement
        'payment_method',
        'airtel_number',
        'moov_number',
        'account_holder_name',
        'bank_name',
        'rib_document_url',

        // Validation
        'certify_truth',
        'accept_escrow',
        'signature',
      ])

      console.log('✅ [ClientController] Données filtrées:', Object.keys(data).length, 'champs')

      // Vérifier si l'email existe déjà
      console.log('🔍 [ClientController] Vérification email existant:', data.email)
      const existingUser = await User.findBy('email', data.email)
      if (existingUser) {
        console.log('❌ [ClientController] Email déjà utilisé')
        return response.conflict({
          success: false,
          message: 'Cet email est déjà utilisé',
        })
      }

      // Hasher le mot de passe
      if (data.password) {
        console.log('🔐 [ClientController] Hashage du mot de passe')
        data.password = await hash.make(data.password)
      }

      // Définir les valeurs par défaut pour le marchand
      if (data.role === 'merchant') {
        console.log('🏪 [ClientController] Création compte MARCHAND')
        data.verification_status = 'pending'
        data.is_verified = false
        console.log('  - vendor_type:', data.vendor_type)
        console.log('  - commercial_name:', data.commercial_name)
        console.log('  - whatsapp_phone:', data.whatsapp_phone)
        console.log('  - payment_method:', data.payment_method)
      } else {
        console.log('👤 [ClientController] Création compte CLIENT')
      }

      // Créer l'utilisateur
      console.log('💾 [ClientController] Sauvegarde en base de données...')
      const user = await User.create(data)

      console.log('✅ [ClientController] Utilisateur créé avec succès!')
      console.log('📊 [ClientController] Récapitulatif:')
      console.log('  - ID:', user.id)
      console.log('  - Nom:', user.full_name)
      console.log('  - Email:', user.email)
      console.log('  - Role:', user.role)
      console.log('  - Pays:', user.country)
      console.log('  - Quartier:', user.neighborhood)

      if (user.role === 'merchant') {
        console.log('  - Type vendeur:', user.vendor_type)
        console.log('  - Nom commercial:', user.commercial_name)
        console.log('  - WhatsApp:', user.whatsapp_phone)
        console.log('  - Paiement:', user.payment_method)
        console.log('  - Logo URL:', user.logo_url || '❌ Non fourni')
        console.log('  - CNI Recto:', user.id_front_url || '❌ Non fourni')
        console.log('  - Statut vérification:', user.verification_status)
      }

      console.log('📝 [ClientController] ===== FIN INSCRIPTION =====')

      return response.created({
        success: true,
        message: 'Inscription réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
      })

    } catch (error) {
      console.log('💥 [ClientController] ERREUR INSCRIPTION:', error.message)
      console.log('📚 [ClientController] Stack trace:', error.stack)

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de l\'inscription',
        error: error.message,
      })
    }
  }
}