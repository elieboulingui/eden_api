import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'coupons'

  async up() {
    // Vérifier si la colonne user_id n'existe pas déjà
    const hasColumn = await this.schema.hasColumn(this.tableName, 'user_id')

    if (!hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        // Ajouter la colonne user_id (UUID)
        table.uuid('user_id').nullable().after('type')

        // Ajouter un index pour les performances
        table.index('user_id')
      })
    }
  }

  async down() {
    const hasColumn = await this.schema.hasColumn(this.tableName, 'user_id')

    if (hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropIndex(['user_id'])
        table.dropColumn('user_id')
      })
    }
  }
}
