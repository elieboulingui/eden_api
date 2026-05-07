import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/categories'
import Product from '#models/Product'
// En haut du fichier

export default class CategoriesController {

  // 🔹 Liste toutes les catégories
 // 🔹 Liste toutes les catégories
async index({ response }: HttpContext) {
  try {
    const categories = await Category.query()

    // ✅ Pour chaque catégorie, compter les vrais produits
    const formattedCategories = await Promise.all(
      categories.map(async (c) => {
        // Compter les produits réels non archivés dans cette catégorie
        const productCount = await Product.query()
          .where('category_id', c.id)
          .where('isArchived', false)
          .count('* as total')

        const realCount = parseInt(productCount[0].$extras.total) || 0

        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          image_url: c.image_url,
          icon_name: c.icon_name,
          description: c.description,
          product_count: realCount,  // ✅ Utiliser le comptage réel
          sort_order: c.sort_order ?? 0,
          is_active: c.is_active,
        }
      })
    )

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

      // 1. Récupérer la catégorie par son nom
      const category = await Category.query()
        .where('name', params.name)
        .where('is_active', true)
        .first()

      console.log('Catégorie trouvée?', category ? 'Oui' : 'Non')

      if (!category) {
        return response.status(404).json({
          success: false,
          message: 'Catégorie non trouvée',
        })
      }

      console.log('Catégorie:', {
        id: category.id,
        name: category.name,
        product_count: category.product_count,
      })

      // 2. Récupérer TOUS les produits qui ont cette category_id
      //    C'est la méthode la plus fiable !
      const products = await Product.query()
        .where('category_id', category.id)
        .where('stock', '>', 0)
        .orderBy('created_at', 'desc')

      console.log(`✅ ${products.length} produits trouvés avec category_id = ${category.id}`)

      // 3. Vérifier que tous les produits ont la même catégorie
      const uniqueCategoryIds = [...new Set(products.map(p => p.category_id))]

      if (uniqueCategoryIds.length === 1) {
        console.log(`✅ Tous les ${products.length} produits ont la même catégorie: ${category.name}`)
      } else {
        console.warn(`⚠️ Attention: Les produits ont des catégories différentes:`, uniqueCategoryIds)
      }

      // 4. Formater la réponse
      const categoryData = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        image_url: category.image_url,
        icon_name: category.icon_name,
        description: category.description,
        product_count: products.length,  // Utiliser le nombre réel de produits
        sort_order: category.sort_order,
        is_active: category.is_active,
        created_at: category.created_at,
        updated_at: category.updated_at,
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          stock: product.stock,
          image_url: product.image_url,
          created_at: product.createdAt,
        })),
      }

      console.log('=== FIN REQUÊTE SUCCÈS ===')

      return response.status(200).json({
        success: true,
        data: categoryData,
      })

    } catch (error: any) {
      console.error('=== ERREUR ===')
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
