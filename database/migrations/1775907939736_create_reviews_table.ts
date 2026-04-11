import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reviews'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('title').nullable()
      table.string('status').notNullable().defaultTo('pending')
      table.boolean('is_verified_purchase').notNullable().defaultTo(false)
      table.integer('helpful_count').notNullable().defaultTo(0)
      table.index(['status'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('title')
      table.dropColumn('status')
      table.dropColumn('is_verified_purchase')
      table.dropColumn('helpful_count')
      table.dropIndex(['status'])
    })
  }
}
