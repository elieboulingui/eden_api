// app/Controllers/Http/MypvitController.ts
import type { HttpContext } from '@adonisjs/core/http'
import MypvitApiService from '../services/MypvitApiService.ts'
import MypvitSecretService from '../services/mypvit_secret_service.js'

export default class MypvitController {

  /**
   * Renouveler la clé secrète
   * POST /api/v1/mypvit/renew-secret
   */
  public async renewSecret({ response }: HttpContext) {
    try {
      const newSecret = await MypvitSecretService.forceRenewal()

      return response.status(200).json({
        success: true,
        message: 'Secret renewed successfully',
        data: {
          operation_account_code: newSecret.accountCode,
          secret: newSecret.key,
          expires_in: Math.floor(newSecret.expiresAt.diffNow('seconds').seconds),
          renewed_at: newSecret.renewedAt.toISO(),
        },
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Failed to renew secret',
        error: error.message,
      })
    }
  }

  /**
   * Obtenir la clé actuelle (masquée)
   * GET /api/v1/mypvit/secret
   */
  public async getCurrentSecret({ response }: HttpContext) {
    try {
      const secret = await MypvitSecretService.getSecret()

      // Masquer la clé pour la sécurité
      const maskedSecret = secret.substring(0, 8) + '...' + secret.substring(secret.length - 4)

      return response.status(200).json({
        success: true,
        data: {
          secret_masked: maskedSecret,
          hint: 'Use this for debugging only',
        },
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve secret',
        error: error.message,
      })
    }
  }

  /**
   * Liste des pays disponibles
   * GET /api/v1/mypvit/countries
   */
  public async getCountries({ request, response }: HttpContext) {
    try {
      const forceRefresh = request.input('refresh', false)

      const countries = await MypvitApiService.getCountries(forceRefresh)

      return response.status(200).json({
        success: true,
        message: 'Countries retrieved successfully',
        data: {
          total: countries.length,
          countries: countries,
        },
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve countries',
        error: error.message,
      })
    }
  }

  /**
   * Liste des opérateurs pour un pays
   * GET /api/v1/mypvit/operators?countryCode=GA
   */
  public async getOperators({ request, response }: HttpContext) {
    try {
      const countryCode = request.input('countryCode')
      const activeOnly = request.input('activeOnly', false)
      const forceRefresh = request.input('refresh', false)

      // Validation
      if (!countryCode) {
        return response.status(400).json({
          success: false,
          message: 'countryCode parameter is required',
        })
      }

      // Valider le format du code pays (2 lettres)
      if (!/^[A-Z]{2}$/i.test(countryCode)) {
        return response.status(400).json({
          success: false,
          message: 'Invalid country code format. Use ISO 3166-1 alpha-2 (e.g., GA, CM)',
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
        message: `Operators for ${countryCode.toUpperCase()} retrieved successfully`,
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
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve operators',
        error: error.message,
      })
    }
  }

  /**
   * Pays avec leurs opérateurs respectifs
   * GET /api/v1/mypvit/countries-with-operators
   */
  public async getCountriesWithOperators({ request, response }: HttpContext) {
    try {
      const activeOnly = request.input('activeOnly', false)

      const countriesWithOperators = await MypvitApiService.getCountriesWithOperators()

      let result = countriesWithOperators.map(country => ({
        name: country.name,
        iso_code: country.iso_code,
        status: country.status,
        operators_count: country.operators.length,
        operators: activeOnly
          ? country.operators.filter(op => op.active)
          : country.operators.map(op => ({
            name: op.name,
            slug: op.slug,
            prefix: op.prefix,
            active: op.active,
            image: op.image_path,
          })),
      }))

      // Filtrer les pays sans opérateurs si demandé
      if (request.input('withOperatorsOnly', false)) {
        result = result.filter(country => country.operators.length > 0)
      }

      return response.status(200).json({
        success: true,
        message: 'Countries with operators retrieved successfully',
        data: {
          total_countries: result.length,
          countries: result,
        },
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve countries with operators',
        error: error.message,
      })
    }
  }

  /**
   * Vérifier la disponibilité d'un opérateur
   * GET /api/v1/mypvit/check-operator?countryCode=GA&operatorSlug=airtel-money
   */
  public async checkOperator({ request, response }: HttpContext) {
    try {
      const countryCode = request.input('countryCode')
      const operatorSlug = request.input('operatorSlug')

      if (!countryCode || !operatorSlug) {
        return response.status(400).json({
          success: false,
          message: 'countryCode and operatorSlug parameters are required',
        })
      }

      const isAvailable = await MypvitApiService.isOperatorAvailable(
        countryCode,
        operatorSlug
      )

      return response.status(200).json({
        success: true,
        data: {
          country_code: countryCode.toUpperCase(),
          operator_slug: operatorSlug,
          available: isAvailable,
        },
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Failed to check operator availability',
        error: error.message,
      })
    }
  }

  /**
   * Vider le cache
   * POST /api/v1/mypvit/clear-cache
   */
  public async clearCache({ request, response }: HttpContext) {
    try {
      const countryCode = request.input('countryCode')
      MypvitApiService.clearCountryCache(countryCode)

      return response.status(200).json({
        success: true,
        message: countryCode
          ? `Cache cleared for ${countryCode}`
          : 'All cache cleared',
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        error: error.message,
      })
    }
  }
}
