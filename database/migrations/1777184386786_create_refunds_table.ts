// database/migrations/xxxx_create_refunds_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'refunds'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      
      // Références - Syntaxe corrigée
      table.uuid('order_id').notNullable()
      table.foreign('order_id').references('id').inTable('orders').onDelete('CASCADE')
      
      table.uuid('user_id').nullable()
      table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL')
      
      table.uuid('admin_id').nullable()
      table.foreign('admin_id').references('id').inTable('users').onDelete('SET NULL')
      
      // Infos remboursement
      table.decimal('amount', 15, 2).notNullable()
      table.string('currency', 3).defaultTo('XAF')
      table.enu('status', ['pending', 'processing', 'approved', 'rejected', 'completed']).defaultTo('pending')
      table.enu('method', ['original_payment', 'wallet_credit', 'bank_transfer', 'mobile_money']).defaultTo('original_payment')
      
      // Référence externe
      table.string('transaction_reference').nullable()
      table.string('external_transaction_id').nullable()
      
      // Motif et détails
      table.text('reason').notNullable()
      table.enu('reason_type', [
        'product_unavailable', 
        'shipping_delay', 
        'defective_product', 
        'wrong_product', 
        'customer_cancellation',
        'duplicate_order',
        'fraudulent_transaction',
        'other'
      ]).nullable()
      
      table.text('admin_notes').nullable()
      table.text('customer_notes').nullable()
      
      // Détails des produits remboursés (JSON)
      table.jsonb('refunded_items').nullable()
      
      // Dates
      table.timestamp('requested_at').notNullable().defaultTo(this.now())
      table.timestamp('processed_at').nullable()
      table.timestamp('completed_at').nullable()
      
      // Champs auto
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
      
      // Index pour optimisation
      table.index(['order_id'])
      table.index(['status'])
      table.index(['requested_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}