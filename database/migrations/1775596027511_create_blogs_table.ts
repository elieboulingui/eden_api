// database/migrations/[timestamp]_create_blog_posts_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'blog_posts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('title').notNullable()
      table.string('slug').notNullable().unique()
      table.text('excerpt').notNullable()
      table.text('content').notNullable()
      table.string('image_url').nullable()
      table.string('category').notNullable()
      table.string('author_name').notNullable()
      table.uuid('author_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('read_time').defaultTo(5)
      table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft')
      table.integer('views').defaultTo(0)
      table.string('meta_title').nullable()
      table.text('meta_description').nullable()
      table.jsonb('tags').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.timestamp('published_at', { useTz: true }).nullable()

      // Index pour améliorer les performances
      table.index(['slug'])
      table.index(['status'])
      table.index(['category'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}