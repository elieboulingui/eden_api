import { BaseSchema } from '@adonisjs/lucid/schema'

export default class Testimonials extends BaseSchema {
  protected tableName = 'testimonials'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()

      table
        .uuid('user_id') // 👈 UUID ici aussi
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.integer('rating').notNullable()
      table.text('text').notNullable()

      table.timestamps(true)
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}