// app/models/Product.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Category from './categories.js'
import Review from './review.js'  // ✅ Ajouter l'import
import OrderItem from './OrderItem.js'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: string  // UUID

  @column()
  declare name: string

  @column()
  declare price: number

  @column()
  declare old_price: number | null  // ✅ Ajouté pour les promotions

  @column()
  declare description: string

  @column()
  declare stock: number

  @column()
  declare rating: number  // Note moyenne (calculée)

  @column()
  declare reviews_count: number  // ✅ Nombre total d'avis

  @column()
  declare user_id: string

  @column({ columnName: 'category_id' })
  declare category_id: string | null

  @column({ columnName: 'image_url' })
  declare image_url: string | null

  @column()
  declare category: string | null  // Ancienne colonne textuelle (à garder pour compatibilité)

  @column()
  declare origin: string | null

  @column()
  declare weight: string | null

  @column()
  declare packaging: string | null

  @column()
  declare conservation: string | null

  @column()
  declare isNew: boolean

  @column()
  declare isOnSale: boolean

  @column()
  declare sales: number  // Nombre de ventes

  @column()
  declare likes: number  // ✅ Nombre de "j'aime"

  @column()
  declare status: string  // 'active', 'inactive', 'draft'

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @beforeCreate()
  static assignUuid(product: Product) {
    if (!product.id) {
      product.id = crypto.randomUUID()
    }
  }

  // ================= RELATIONS =================

  // Vendeur / Marchand
  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  // Catégorie (relation via category_id)
  @belongsTo(() => Category, {
    foreignKey: 'category_id',
  })
  declare categoryRelation: BelongsTo<typeof Category>

  // ✅ Avis / Reviews
  @hasMany(() => Review, {
    foreignKey: 'product_id',
  })
  declare reviews: HasMany<typeof Review>

  // ✅ Éléments de commande (pour les ventes)
  @hasMany(() => OrderItem, {
    foreignKey: 'product_id',
  })
  declare orderItems: HasMany<typeof OrderItem>

  // ================= MÉTHODES UTILITAIRES =================

  /**
   * Calcule la réduction en pourcentage
   */
  get discountPercentage(): number | null {
    if (this.old_price && this.old_price > this.price) {
      return Math.round(((this.old_price - this.price) / this.old_price) * 100)
    }
    return null
  }

  /**
   * Vérifie si le produit est en stock
   */
  get isInStock(): boolean {
    return this.stock > 0
  }

  /**
   * Vérifie si le stock est faible
   */
  get isLowStock(): boolean {
    return this.stock > 0 && this.stock <= 5
  }

  /**
   * Formate le prix pour l'affichage
   */
  get formattedPrice(): string {
    return new Intl.NumberFormat('fr-FR').format(this.price) + ' FCFA'
  }

  /**
   * Formate l'ancien prix pour l'affichage
   */
  get formattedOldPrice(): string | null {
    if (this.old_price) {
      return new Intl.NumberFormat('fr-FR').format(this.old_price) + ' FCFA'
    }
    return null
  }
}
