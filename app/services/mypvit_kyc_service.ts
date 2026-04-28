// app/services/mypvit_kyc_service.ts
import axios, { type AxiosInstance } from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

export class MypvitKYCService {
  private httpClient: AxiosInstance
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  private readonly CODE_URL = 'NH3QVMNQOWNXRZ91'

  constructor() {
    this.httpClient = axios.create({ baseURL: this.BASE_URL, timeout: 10000 })
    this.httpClient.interceptors.request.use(async (c) => {
      c.headers['X-Secret'] = await MypvitSecretService.getSecret()
      return c
    })
  }

  async getKYCInfo(phone: string, operatorCode: string): Promise<any> {
    const res = await this.httpClient.get(`/${this.CODE_URL}/v2/kyc`, {
      params: { customerAccountNumber: phone, operatorCode }
    })
    return res.data?.data || res.data
  }
}

export default new MypvitKYCService()
