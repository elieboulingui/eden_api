// app/services/mypvit_api_service.ts
import axios, { type AxiosInstance } from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'
import { DateTime } from 'luxon'

interface Country {
  name: string; iso_code: string; status: boolean
}

interface Operator {
  name: string; active: boolean; slug: string
  image_path: string; prefix: string
  country: Country
}

interface CacheItem<T> {
  data: T; timestamp: DateTime; ttl: number
}

export class MypvitApiService {
  private httpClient: AxiosInstance
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  private readonly CODE_URL = '3G9PSRUEHJOXA6QC'
  private cache: Map<string, CacheItem<any>> = new Map()

  constructor() {
    this.httpClient = axios.create({ baseURL: this.BASE_URL, timeout: 10000 })
    this.httpClient.interceptors.request.use(async (config) => {
      const secret = await MypvitSecretService.getSecret()
      console.log('🔐 [ApiService] Secret utilisé:', secret?.substring(0, 15) + '...')
      config.headers['X-Secret'] = secret
      return config
    })
  }

  async getCountries(forceRefresh = false): Promise<Country[]> {
    const key = 'countries'
    if (!forceRefresh && this.cache.has(key)) {
      console.log('📦 [ApiService] Countries depuis cache')
      return this.cache.get(key)!.data
    }

    const url = `/${this.CODE_URL}/get-countries`
    console.log('📡 [ApiService] GET', this.BASE_URL + url)

    try {
      const res = await this.httpClient.get<Country[]>(url)
      console.log('✅ [ApiService] Countries récupérés:', res.data?.length, 'pays')
      this.cache.set(key, { data: res.data, timestamp: DateTime.now(), ttl: 3600 })
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

  // app/services/mypvit_api_service.ts

  async getOperators(countryCode: string, forceRefresh = false): Promise<Operator[]> {
    const key = `operators_${countryCode}`
    if (!forceRefresh && this.cache.has(key)) {
      console.log('📦 Depuis cache')
      return this.cache.get(key)!.data
    }

    const url = `/${this.CODE_URL}/get-operators`
    const params = { 'country-code': countryCode.toUpperCase() }  // ✅ country-code avec tiret

    console.log('📡 GET', this.BASE_URL + url, params)

    const res = await this.httpClient.get<Operator[]>(url, { params })
    console.log('✅', res.data?.length, 'opérateurs')
    this.cache.set(key, { data: res.data, timestamp: DateTime.now(), ttl: 1800 })
    return res.data
  }

  async getActiveOperators(countryCode: string): Promise<Operator[]> {
    const ops = await this.getOperators(countryCode)
    return ops.filter(op => op.active)
  }

  async getCountriesWithOperators(): Promise<Array<Country & { operators: Operator[] }>> {
    const countries = await this.getCountries()
    return Promise.all(countries.map(async (c) => ({
      ...c, operators: await this.getOperators(c.iso_code).catch(() => [])
    })))
  }

  async isOperatorAvailable(countryCode: string, slug: string): Promise<boolean> {
    const ops = await this.getOperators(countryCode)
    return ops.some(op => op.slug === slug && op.active)
  }

  clearCache(): void { this.cache.clear() }
  clearCountryCache(countryCode?: string): void {
    if (countryCode) this.cache.delete(`operators_${countryCode.toUpperCase()}`)
    else this.cache.clear()
  }
}

export default new MypvitApiService()