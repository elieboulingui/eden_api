// database/migrations/XXXXXXXXXXXX_ALTER_KYC_TABLE.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'kycs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Ajouter les index s'ils n'existent pas
      table.index(['numero_telephone'], 'idx_kyc_phone')
      table.index(['operateur'], 'idx_kyc_operateur')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['numero_telephone'], 'idx_kyc_phone')
      table.dropIndex(['operateur'], 'idx_kyc_operateur')
    })
  }
}
