import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admin_fees'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // UUID avec génération automatique
      table.uuid('id').primary().defaultTo(this.db.knexRawQuery('gen_random_uuid()'))

      // Référence à la commande
      table.uuid('order_id')
        .references('id')
        .inTable('orders')
        .onDelete('CASCADE')
        .notNullable()

      // Numéro de commande (redondant pour faciliter les recherches)
      table.string('order_number').notNullable()

      // Montant du frais admin
      table.decimal('amount', 15, 2).notNullable()

      // Pourcentage appliqué
      table.decimal('percentage', 5, 2).notNullable()

      // Admin qui a traité la commande
      table.uuid('admin_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      // Date de création
      table.timestamp('created_at', { useTz: true })
        .notNullable()
        .defaultTo(this.now())

      // Index pour optimiser les performances
      table.index(['order_id'], 'admin_fees_order_id_idx')
      table.index(['admin_id'], 'admin_fees_admin_id_idx')
      table.index(['order_number'], 'admin_fees_order_number_idx')
      table.index(['created_at'], 'admin_fees_created_at_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}