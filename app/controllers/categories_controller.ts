import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/categories'
import Product from '#models/Product'
// En haut du fichier
import Database from '@adonisjs/lucid/services/db'

export default class CategoriesController {

  // 🔹 Liste toutes les catégories
  async index({ response }: HttpContext) {
    try {
      const categories = await Category.query()

      const formattedCategories = categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image_url: c.image_url,
        icon_name: c.icon_name,
        description: c.description,
        product_count: c.product_count ?? 0,
        sort_order: c.sort_order ?? 0,
        is_active: c.is_active,
      }))

      return response.status(200).json({
        success: true,
        message: 'Catégories récupérées avec succès',
        data: formattedCategories,
        count: formattedCategories.length,
      })
    } catch (error: any) {
      console.error('Erreur récupération catégories:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des catégories',
        error: error.message,
      })
    }
  }

  // 🔹 Détails d'une catégorie
  async show({ params, response }: HttpContext) {
    try {
      console.log('=== DÉBUT REQUÊTE ===')
      console.log('Param name:', params.name)

      // 1. Récupérer la catégorie avec requête brute
      const categoryRaw = await Database
        .from('categories')
        .where('name', params.name)
        .first()

      console.log('Catégorie trouvée?', categoryRaw ? 'Oui' : 'Non')

      if (!categoryRaw) {
        return response.status(404).json({
          success: false,
          message: 'Catégorie non trouvée',
        })
      }

      console.log('Catégorie brute:', JSON.stringify(categoryRaw, null, 2))
      console.log('Type de product_ids:', typeof categoryRaw.product_ids)
      console.log('Valeur de product_ids:', categoryRaw.product_ids)

      // 2. Parser les product_ids
      let productIds: string[] = []

      if (categoryRaw.product_ids) {
        // Si c'est une string JSON
        if (typeof categoryRaw.product_ids === 'string') {
          try {
            const parsed = JSON.parse(categoryRaw.product_ids)
            productIds = Array.isArray(parsed) ? parsed : []
            console.log('JSON parsé avec succès:', productIds)
          } catch (parseError) {
            console.error('Erreur de parsing JSON:', parseError)

            // Essayer de parser comme CSV si contient des virgules
            if (categoryRaw.product_ids.includes(',')) {
              productIds = categoryRaw.product_ids.split(',').map((id: string) => id.trim())
              console.log('CSV parsé:', productIds)
            }
          }
        }
        // Si c'est déjà un tableau
        else if (Array.isArray(categoryRaw.product_ids)) {
          productIds = categoryRaw.product_ids
          console.log('Déjà un tableau:', productIds)
        }
      }

      console.log('Product IDs finaux:', productIds)
      console.log('Nombre de product IDs:', productIds.length)

      // 3. Récupérer les produits
      let products: any[] = []

      if (productIds.length > 0) {
        try {
          products = await Product.query()
            .whereIn('id', productIds)
            .where('stock', '>', 0)
            .limit(12)

          console.log('Produits trouvés:', products.length)
        } catch (productError) {
          console.error('Erreur récupération produits:', productError)
        }
      }

      // 4. Formater la réponse
      const categoryData = {
        id: categoryRaw.id,
        name: categoryRaw.name,
        slug: categoryRaw.slug,
        image_url: categoryRaw.image_url,
        icon_name: categoryRaw.icon_name,
        description: categoryRaw.description,
        product_count: categoryRaw.product_count,
        sort_order: categoryRaw.sort_order,
        is_active: categoryRaw.is_active,
        product_ids: productIds,
        created_at: categoryRaw.created_at,
        updated_at: categoryRaw.updated_at,
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          stock: product.stock,
          image_url: product.image_url,
        })),
      }

      console.log('=== FIN REQUÊTE SUCCÈS ===')

      return response.status(200).json({
        success: true,
        data: categoryData,
      })

    } catch (error: any) {
      console.error('=== ERREUR CATASTROPHIQUE ===')
      console.error('Message:', error.message)
      console.error('Stack:', error.stack)

      return response.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      })
    }
  }


  // 🔹 Créer une nouvelle catégorie
  async store({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'name',
        'slug',
        'description',
        'sort_order',
        'is_active',
        'user_id',
        'parent_id',
        'image_url',
        'icon_name'
      ])

      const category = await Category.create(data)

      return response.status(201).json({
        success: true,
        message: 'Catégorie créée avec succès',
        data: category,
      })
    } catch (error: any) {
      console.error('Erreur store category:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création de la catégorie',
        error: error.message,
      })
    }
  }

  // 🔹 Mettre à jour une catégorie
  async update({ params, request, response }: HttpContext) {
    try {
      const category = await Category.findOrFail(params.id)
      const data = request.only([
        'name',
        'slug',
        'description',
        'sort_order',
        'is_active',
        'parent_id',
        'image_url',
        'icon_name'
      ])

      category.merge(data)
      await category.save()

      return response.status(200).json({
        success: true,
        message: 'Catégorie mise à jour avec succès',
        data: category,
      })
    } catch (error: any) {
      console.error('Erreur update category:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la catégorie',
        error: error.message,
      })
    }
  }

  // 🔹 Supprimer une catégorie
  async destroy({ params, response }: HttpContext) {
    try {
      const category = await Category.findOrFail(params.id)
      await category.delete()

      return response.status(200).json({
        success: true,
        message: 'Catégorie supprimée avec succès',
      })
    } catch (error: any) {
      console.error('Erreur destroy category:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression de la catégorie',
        error: error.message,
      })
    }
  }

  // 🔹 Créer un produit dans une catégorie
  async createProduct({ params, request, response }: HttpContext) {
    try {
      const category = await Category.findOrFail(params.id)

      const data = request.only([
        'name',
        'price',
        'description',
        'stock',
        'image_url',
        'origin',
        'weight',
        'packaging',
        'conservation',
        'isNew',
        'isOnSale',
        'user_id',
      ])

      const product = await Product.create({
        ...data,
        category_id: category.id,
      })

      if (!category.product_ids) {
        category.product_ids = []
      }
      if (!category.product_ids.includes(product.id)) {
        category.product_ids.push(product.id)
        await category.save()
      }

      return response.status(201).json({
        success: true,
        message: 'Produit créé et ajouté à la catégorie avec succès',
        data: product,
      })
    } catch (error: any) {
      console.error('Erreur création produit:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du produit',
        error: error.message,
      })
    }
  }
}
