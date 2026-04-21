// database/migrations/xxx_create_withdrawals.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'withdrawals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.uuid('wallet_id').references('id').inTable('wallets').onDelete('CASCADE')
      table.decimal('amount', 15, 2).notNullable()
      table.decimal('fee', 15, 2).defaultTo(0)
      table.decimal('net_amount', 15, 2).notNullable()
      table.string('currency', 10).defaultTo('XOF')
      table.enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled']).defaultTo('pending')
      table.string('payment_method', 50).notNullable()
      table.string('operator', 50).nullable()
      table.string('account_number', 50).notNullable()
      table.string('account_name', 255).notNullable()
      table.string('bank_name', 100).nullable()
      table.string('reference', 100).notNullable().unique()
      table.string('transaction_id', 100).nullable()
      table.string('external_reference', 255).nullable()
      table.text('notes').nullable()
      table.text('failure_reason').nullable()
      table.string('ip_address', 45).nullable()
      table.text('user_agent').nullable()
      table.json('metadata').nullable()
      table.uuid('processed_by').nullable()
      table.timestamp('processed_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}