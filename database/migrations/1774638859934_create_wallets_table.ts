import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
         table.increments('id').primary() // Auto-incrément integer
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE').unique()
      table.decimal('balance', 15, 2).defaultTo(0)
      table.string('currency').defaultTo('FCFA')
      table.enum('status', ['active', 'blocked', 'pending']).defaultTo('active')
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.index(['user_id'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
