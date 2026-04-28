// app/services/mypvit_api_service.ts
import axios, { type AxiosInstance } from 'axios'
import { DateTime } from 'luxon'

interface Country {
  name: string
  iso_code: string
  status: boolean
}

interface Operator {
  name: string
  active: boolean
  slug: string
  image_path: string
  prefix: string
  country: Country
}

interface CacheItem<T> {
  data: T
  timestamp: DateTime
  ttl: number
}

export class MypvitApiService {
  private httpClient: AxiosInstance
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  private readonly COUNTRIES_CODE_URL = 'YWU3CQKVYFMNPJV6'
  private readonly OPERATORS_CODE_URL = '6HURIG9LHGO0C5HK'
  private cache: Map<string, CacheItem<any>> = new Map()

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    })
  }

  // ==================== PAYS ====================

  async getCountries(forceRefresh = false): Promise<Country[]> {
    const key = 'countries'

    if (!forceRefresh && this.cache.has(key)) {
      const cached = this.cache.get(key)!
      const age = DateTime.now().diff(cached.timestamp, 'seconds').seconds
      if (age < cached.ttl) {
        console.log('📦 [ApiService] Countries depuis cache')
        return cached.data
      }
    }

    const url = `/${this.COUNTRIES_CODE_URL}/get-countries`
    console.log('📡 [ApiService] GET', this.BASE_URL + url)

    try {
      const res = await this.httpClient.get<Country[]>(url)
      console.log('✅ [ApiService] Countries récupérés:', res.data?.length, 'pays')

      this.cache.set(key, {
        data: res.data,
        timestamp: DateTime.now(),
        ttl: 3600
      })

      return res.data
    } catch (error: any) {
      console.error('❌ [ApiService] Erreur getCountries:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      throw error
    }
  }

  // ==================== OPÉRATEURS ====================
  // Pas besoin de secret pour les opérateurs

  async getOperators(countryCode: string, forceRefresh = false): Promise<Operator[]> {
    const key = `operators_${countryCode.toUpperCase()}`

    if (!forceRefresh && this.cache.has(key)) {
      const cached = this.cache.get(key)!
      const age = DateTime.now().diff(cached.timestamp, 'seconds').seconds
      if (age < cached.ttl) {
        console.log('📦 [ApiService] Opérateurs depuis cache')
        return cached.data
      }
    }

    const url = `/${this.OPERATORS_CODE_URL}/get-operators`
    const params = { 'country-code': countryCode.toUpperCase() }

    console.log('📡 [ApiService] GET', this.BASE_URL + url, params)

    try {
      // Pas de secret pour récupérer les opérateurs
      const res = await this.httpClient.get<Operator[]>(url, { params })
      console.log('✅ [ApiService] Opérateurs récupérés:', res.data?.length, 'pour le pays', countryCode)

      this.cache.set(key, {
        data: res.data,
        timestamp: DateTime.now(),
        ttl: 1800
      })

      return res.data
    } catch (error: any) {
      console.error('❌ [ApiService] Erreur getOperators:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      throw error
    }
  }

  // ==================== OPÉRATEURS ACTIFS ====================

  async getActiveOperators(countryCode: string): Promise<Operator[]> {
    const ops = await this.getOperators(countryCode)
    return ops.filter(op => op.active === true)
  }

  // ==================== PAYS AVEC OPÉRATEURS ====================

  async getCountriesWithOperators(): Promise<Array<Country & { operators: Operator[] }>> {
    const countries = await this.getCountries()

    const results = await Promise.all(
      countries.map(async (country) => ({
        ...country,
        operators: await this.getOperators(country.iso_code).catch(() => [])
      }))
    )

    return results
  }

  // ==================== VÉRIFIER OPÉRATEUR ====================

  async isOperatorAvailable(countryCode: string, slug: string): Promise<boolean> {
    const ops = await this.getOperators(countryCode)
    return ops.some(op => op.slug === slug && op.active === true)
  }

  // ==================== CACHE ====================

  clearCache(): void {
    this.cache.clear()
    console.log('🧹 [ApiService] Cache vidé')
  }

  clearCountryCache(countryCode?: string): void {
    if (countryCode) {
      this.cache.delete(`operators_${countryCode.toUpperCase()}`)
      console.log(`🧹 [ApiService] Cache du pays ${countryCode} vidé`)
    } else {
      this.cache.clear()
    }
  }

  // ==================== UTILITAIRES ====================

  getCountriesCodeUrl(): string {
    return this.COUNTRIES_CODE_URL
  }

  getOperatorsCodeUrl(): string {
    return this.OPERATORS_CODE_URL
  }
}

export default new MypvitApiService()
