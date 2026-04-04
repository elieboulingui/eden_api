// database/migrations/xxxx_merchant_withdrawals.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'merchant_withdrawals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.decimal('amount', 15, 2).notNullable()
      table.enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled']).defaultTo('pending')
      table.string('payment_method', 50).notNullable()
      table.string('account_number', 100).notNullable()
      table.string('account_name', 255).notNullable()
      table.string('operator', 50).nullable()
      table.string('reference', 100).notNullable().unique()
      table.string('transaction_id', 255).nullable()
      table.text('notes').nullable()
      table.uuid('processed_by').nullable().references('id').inTable('users')
      table.timestamp('processed_at').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['user_id', 'status'])
      table.index(['reference'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}