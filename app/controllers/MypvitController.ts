// app/controllers/mypvit_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import MypvitApiService from '#services/MypvitApiService'
import MypvitSecretService from '#services/mypvit_secret_service'
import axios from 'axios'

export default class MypvitController {

  /**
   * Liste des pays disponibles
   * GET /api/mypvit/countries
   */
  public async getCountries({ request, response }: HttpContext) {
    try {
      const forceRefresh = request.input('refresh', false)

      const countries = await MypvitApiService.getCountries(forceRefresh)

      return response.status(200).json({
        success: true,
        message: 'Liste des pays récupérée avec succès',
        data: {
          total: countries.length,
          countries: countries.map(country => ({
            name: country.name,
            iso_code: country.iso_code,
            status: country.status,
          })),
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec de la récupération des pays',
        error: error.message,
      })
    }
  }

  /**
   * Liste des opérateurs pour un pays
   * GET /api/mypvit/operators?countryCode=GA
   */
  public async getOperators({ request, response }: HttpContext) {
    try {
      const countryCode = request.input('country_code') || request.input('countryCode')
      const activeOnly = request.input('activeOnly', false)
      const forceRefresh = request.input('refresh', false)

      if (!countryCode) {
        return response.status(400).json({
          success: false,
          message: 'Le paramètre country_code est requis (ex: GA, CI, SN, CM)',
        })
      }

      if (!/^[A-Z]{2}$/i.test(countryCode)) {
        return response.status(400).json({
          success: false,
          message: 'Format de code pays invalide. Utilisez ISO 3166-1 alpha-2 (ex: GA, CM, CI)',
        })
      }

      let operators
      if (activeOnly) {
        operators = await MypvitApiService.getActiveOperators(countryCode)
      } else {
        operators = await MypvitApiService.getOperators(countryCode, forceRefresh)
      }

      return response.status(200).json({
        success: true,
        message: `Opérateurs pour ${countryCode.toUpperCase()} récupérés avec succès`,
        data: {
          country_code: countryCode.toUpperCase(),
          total: operators.length,
          operators: operators.map(op => ({
            name: op.name,
            slug: op.slug,
            prefix: op.prefix,
            active: op.active,
            image: op.image_path,
            country: {
              name: op.country.name,
              iso_code: op.country.iso_code,
            },
          })),
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec de la récupération des opérateurs',
        error: error.message,
      })
    }
  }

  /**
   * Opérateurs actifs uniquement pour un pays
   * GET /api/mypvit/operators/active?countryCode=GA
   */
  public async getActiveOperators({ request, response }: HttpContext) {
    try {
      const countryCode = request.input('countryCode')

      if (!countryCode) {
        return response.status(400).json({
          success: false,
          message: 'Le paramètre countryCode est requis (ex: GA, CI, SN, CM)',
        })
      }

      const operators = await MypvitApiService.getActiveOperators(countryCode)

      return response.status(200).json({
        success: true,
        message: `Opérateurs actifs pour ${countryCode.toUpperCase()} récupérés avec succès`,
        data: {
          country_code: countryCode.toUpperCase(),
          total: operators.length,
          operators: operators.map(op => ({
            name: op.name,
            slug: op.slug,
            prefix: op.prefix,
            image: op.image_path,
          })),
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec de la récupération des opérateurs actifs',
        error: error.message,
      })
    }
  }

  /**
   * Pays avec leurs opérateurs respectifs
   * GET /api/mypvit/countries-with-operators
   */
  public async getCountriesWithOperators({ request, response }: HttpContext) {
    try {
      const activeOnly = request.input('activeOnly', false)
      const withOperatorsOnly = request.input('withOperatorsOnly', false)

      const countriesWithOperators = await MypvitApiService.getCountriesWithOperators()

      let result = countriesWithOperators.map(country => ({
        name: country.name,
        iso_code: country.iso_code,
        status: country.status,
        operators_count: country.operators.length,
        operators: activeOnly
          ? country.operators.filter(op => op.active).map(op => ({
            name: op.name,
            slug: op.slug,
            prefix: op.prefix,
            active: op.active,
            image: op.image_path,
          }))
          : country.operators.map(op => ({
            name: op.name,
            slug: op.slug,
            prefix: op.prefix,
            active: op.active,
            image: op.image_path,
          })),
      }))

      if (withOperatorsOnly) {
        result = result.filter(country => country.operators.length > 0)
      }

      return response.status(200).json({
        success: true,
        message: 'Pays avec opérateurs récupérés avec succès',
        data: {
          total_countries: result.length,
          countries: result,
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec de la récupération des pays avec opérateurs',
        error: error.message,
      })
    }
  }

  /**
   * Vérifier la disponibilité d'un opérateur
   * GET /api/mypvit/check-operator?countryCode=GA&slug=airtel-money
   */
  public async checkOperator({ request, response }: HttpContext) {
    try {
      const countryCode = request.input('countryCode')
      const slug = request.input('slug')

      if (!countryCode || !slug) {
        return response.status(400).json({
          success: false,
          message: 'Les paramètres countryCode et slug sont requis',
        })
      }

      const isAvailable = await MypvitApiService.isOperatorAvailable(countryCode, slug)

      return response.status(200).json({
        success: true,
        data: {
          country_code: countryCode.toUpperCase(),
          operator_slug: slug,
          available: isAvailable,
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec de la vérification de l\'opérateur',
        error: error.message,
      })
    }
  }

  /**
   * Vider le cache
   * POST /api/mypvit/clear-cache
   */
  public async clearCache({ request, response }: HttpContext) {
    try {
      const countryCode = request.input('countryCode')

      if (countryCode) {
        MypvitApiService.clearCountryCache(countryCode)
        return response.status(200).json({
          success: true,
          message: `Cache vidé pour le pays ${countryCode.toUpperCase()}`,
        })
      } else {
        MypvitApiService.clearCache()
        return response.status(200).json({
          success: true,
          message: 'Cache complet vidé avec succès',
        })
      }
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec du vidage du cache',
        error: error.message,
      })
    }
  }

  /**
   * Obtenir les codes URL configurés
   * GET /api/mypvit/code-urls
   */
  public async getCodeUrls({ response }: HttpContext) {
    try {
      return response.status(200).json({
        success: true,
        data: {
          countries_code_url: MypvitApiService.getCountriesCodeUrl(),
          operators_code_url: MypvitApiService.getOperatorsCodeUrl(),
        },
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec de la récupération des codes URL',
        error: error.message,
      })
    }
  }

  // ============================================================
  // === GESTION DU SOLDE =======================================
  // ============================================================

  /**
   * Vérifier le solde pour un opérateur spécifique
   * POST /api/mypvit/check-balance
   * Body: { phoneNumber: "07xxxxxxxx" }
   */
  public async checkBalance({ request, response }: HttpContext) {
    try {
      const { phoneNumber } = request.only(['phoneNumber'])

      if (!phoneNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      // Détecter l'opérateur
      const operatorInfo = MypvitSecretService.getOperatorInfo(phoneNumber)

      console.log(`💰 Vérification solde pour ${operatorInfo.operator}...`)
      console.log(`🔑 Compte: ${operatorInfo.accountCode}`)
      console.log(`🔗 CODE_URL: F8LASHPAOPMIAC2V`)

      // Renouveler le secret si nécessaire
      await MypvitSecretService.renewSecret(phoneNumber)
      const secret = await MypvitSecretService.getSecret(phoneNumber)

      // ✅ CORRECTION : accountOperationCode (pas operationAccountCode)
      const balanceResponse = await axios.get(
        `https://api.mypvit.pro/F8LASHPAOPMIAC2V/balance`,
        {
          headers: {
            'X-Secret': secret,
            'Content-Type': 'application/json'
          },
          params: {
            accountOperationCode: operatorInfo.accountCode  // ✅ Le bon nom de paramètre
          }
        }
      )

      console.log(`✅ Solde ${operatorInfo.operator}:`, balanceResponse.data)

      return response.status(200).json({
        success: true,
        message: `Solde ${operatorInfo.operator} récupéré avec succès`,
        operator: operatorInfo.operator,
        accountCode: operatorInfo.accountCode,
        data: balanceResponse.data
      })

    } catch (error: any) {
      console.error('❌ Erreur checkBalance:', error.response?.data || error.message)

      // Gestion spécifique des erreurs d'authentification
      if (error.response?.data?.error === 'AUTHENTICATION_FAILED') {
        return response.status(401).json({
          success: false,
          message: '🔐 Authentification échouée. Vérifiez le mot de passe du compte.',
          error: error.response?.data?.message,
          details: error.response?.data
        })
      }

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du solde',
        error: error.response?.data?.message || error.message,
        details: error.response?.data || null
      })
    }
  }

  /**
   * Vérifier TOUS les soldes (tous les opérateurs)
   * GET /api/mypvit/all-balances
   */
  public async getAllBalances({ response }: HttpContext) {
    try {
      const balances: any[] = []

      // Tester MOOV (06)
      console.log('💰 Vérification solde MOOV...')
      try {
        const phoneMoov = '0600000000'
        await MypvitSecretService.renewSecret(phoneMoov)
        const secret = await MypvitSecretService.getSecret(phoneMoov)
        const operatorInfo = MypvitSecretService.getOperatorInfo(phoneMoov)

        const balanceResponse = await axios.get(
          `https://api.mypvit.pro/F8LASHPAOPMIAC2V/balance`,
          {
            headers: { 'X-Secret': secret },
            params: { accountOperationCode: operatorInfo.accountCode }  // ✅
          }
        )

        balances.push({
          operator: 'MOOV_MONEY',
          accountCode: operatorInfo.accountCode,
          success: true,
          data: balanceResponse.data
        })
        console.log('✅ Solde MOOV récupéré')
      } catch (error: any) {
        balances.push({
          operator: 'MOOV_MONEY',
          accountCode: 'ACC_69EFB143D4F54',
          success: false,
          error: error.response?.data?.message || error.message
        })
        console.log('❌ Échec solde MOOV:', error.response?.data?.message || error.message)
      }

      // Tester AIRTEL (07)
      console.log('💰 Vérification solde AIRTEL...')
      try {
        const phoneAirtel = '0700000000'
        await MypvitSecretService.renewSecret(phoneAirtel)
        const secret = await MypvitSecretService.getSecret(phoneAirtel)
        const operatorInfo = MypvitSecretService.getOperatorInfo(phoneAirtel)

        const balanceResponse = await axios.get(
          `https://api.mypvit.pro/F8LASHPAOPMIAC2V/balance`,
          {
            headers: { 'X-Secret': secret },
            params: { accountOperationCode: operatorInfo.accountCode }  // ✅
          }
        )

        balances.push({
          operator: 'AIRTEL_MONEY',
          accountCode: operatorInfo.accountCode,
          success: true,
          data: balanceResponse.data
        })
        console.log('✅ Solde AIRTEL récupéré')
      } catch (error: any) {
        balances.push({
          operator: 'AIRTEL_MONEY',
          accountCode: 'ACC_69EFB0E02FCA3',
          success: false,
          error: error.response?.data?.message || error.message
        })
        console.log('❌ Échec solde AIRTEL:', error.response?.data?.message || error.message)
      }

      return response.status(200).json({
        success: true,
        message: 'Soldes récupérés',
        data: {
          timestamp: new Date().toISOString(),
          balances
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur getAllBalances:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des soldes',
        error: error.message
      })
    }
  }

  // ============================================================
  // === GESTION DU SECRET ======================================
  // ============================================================

  /**
   * Renouveler le secret
   * POST /api/mypvit/renew-secret
   * Body: { phoneNumber: "07xxxxxxxx" }
   */
  public async renewSecret({ request, response }: HttpContext) {
    try {
      const { phoneNumber } = request.only(['phoneNumber'])

      const secret = await MypvitSecretService.renewSecret(phoneNumber)

      return response.status(200).json({
        success: true,
        message: 'Secret renouvelé avec succès',
        data: {
          accountCode: secret.accountCode,
          expiresAt: secret.expiresAt,
          renewedAt: secret.renewedAt
        }
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec du renouvellement du secret',
        error: error.message
      })
    }
  }

  /**
   * Obtenir le secret actuel
   * GET /api/mypvit/secret?phoneNumber=07xxxxxxxx
   */
  public async getCurrentSecret({ request, response }: HttpContext) {
    try {
      const phoneNumber = request.input('phoneNumber')

      const secret = await MypvitSecretService.getSecret(phoneNumber)
      const operatorInfo = phoneNumber ? MypvitSecretService.getOperatorInfo(phoneNumber) : null

      return response.status(200).json({
        success: true,
        message: 'Secret récupéré avec succès',
        data: {
          secret: secret ? secret.substring(0, 15) + '...' : null,
          operator: operatorInfo?.operator || 'inconnu',
          accountCode: operatorInfo?.accountCode || 'inconnu'
        }
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Échec de la récupération du secret',
        error: error.message
      })
    }
  }
}
