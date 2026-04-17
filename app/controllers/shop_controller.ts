import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'

export default class ShopController {
  
  async apiIndex({ request, response }: HttpContext) {
    try {
      console.log('=== API SHOP START ===')
      
      const page = Math.max(1, parseInt(request.input('page', '1') || '1'))
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'newest')
      const limit = Math.min(parseInt(request.input('limit', '12') || '12'), 100)

      console.log('Params:', { page, category, search, sort, limit })

      // Requête de base pour les produits
      let productsQuery = Product.query()
        .preload('user', (query) => query.select('id', 'full_name', 'country'))

      // Filtre par catégorie
      if (category && category !== 'all' && category !== '') {
        productsQuery = productsQuery.where('category', category)
      }

      // Recherche
      if (search && search.trim() !== '') {
        const searchTerm = `%${search.trim()}%`
        productsQuery = productsQuery.where((builder) => {
          builder.where('name', 'LIKE', searchTerm)
            .orWhere('description', 'LIKE', searchTerm)
        })
      }

      // Tri
      switch (sort) {
        case 'price_asc':
          productsQuery = productsQuery.orderBy('price', 'asc')
          break
        case 'price_desc':
          productsQuery = productsQuery.orderBy('price', 'desc')
          break
        default:
          productsQuery = productsQuery.orderBy('created_at', 'desc')
          break
      }

      const products = await productsQuery.paginate(page, limit)
      console.log(`✅ ${products.length} produits trouvés`)

      // Si aucun produit trouvé, renvoyer un tableau vide mais avec success: true
      const allProducts = products.all()

      // Récupérer les nouveaux produits
      let newProducts: any[] = []
      try {
        const newProductsQuery = await Product.query()
          .preload('user', (query) => query.select('id', 'full_name', 'country'))
          .where('is_new', true)
          .orderBy('created_at', 'desc')
          .limit(8)
        newProducts = newProductsQuery
        console.log(`✅ ${newProducts.length} nouveaux produits trouvés`)
      } catch (err) {
        console.log('⚠️ Colonne is_new inexistante, on prend les plus récents')
        const recentProducts = await Product.query()
          .preload('user', (query) => query.select('id', 'full_name', 'country'))
          .orderBy('created_at', 'desc')
          .limit(8)
        newProducts = recentProducts
      }

      // Récupérer les produits en promotion
      let productsOnSale: any[] = []
      try {
        const onSaleQuery = await Product.query()
          .preload('user', (query) => query.select('id', 'full_name', 'country'))
          .whereNotNull('old_price')
          .where('old_price', '>', 0)
          .orderBy('created_at', 'desc')
          .limit(8)
        productsOnSale = onSaleQuery
      } catch (err) {
        console.log('⚠️ Colonne old_price inexistante, pas de produits en promo')
        productsOnSale = []
      }

      // Meilleures ventes
      let bestSellers: any[] = []
      try {
        const bestQuery = await Product.query()
          .preload('user', (query) => query.select('id', 'full_name', 'country'))
          .orderBy('created_at', 'desc')
          .limit(8)
        bestSellers = bestQuery
      } catch (err) {
        console.log('⚠️ Erreur bestSellers')
        bestSellers = []
      }

      // Si newProducts est vide, utiliser allProducts
      if (newProducts.length === 0) {
        newProducts = allProducts.slice(0, 8)
      }
      
      // Si bestSellers est vide, utiliser allProducts
      if (bestSellers.length === 0) {
        bestSellers = allProducts.slice(0, 8)
      }

      // Statistiques
      const totalProductsResult = await Product.query().count('* as total')
      
      let totalMerchants = 0
      try {
        const totalMerchantsResult = await Product.query()
          .distinct('user_id')
          .count('* as total')
        totalMerchants = Number(totalMerchantsResult[0].$extras.total)
      } catch (err) {
        console.log('⚠️ Erreur comptage marchands')
      }

      // Fonction de formatage des produits
      const formatProduct = (p: any) => {
        let userData = null
        if (p.user) {
          userData = {
            id: String(p.user.id),
            name: p.user.full_name || p.user.name || '',
            shopName: p.user.shop_name || p.user.full_name || null,
          }
        }

        const oldPrice = p.old_price || null
        const isOnSale = oldPrice ? oldPrice > p.price : false
        const discountPercentage = oldPrice && isOnSale
          ? Math.round(((oldPrice - p.price) / oldPrice) * 100)
          : null

        return {
          id: String(p.id),
          name: p.name || 'Sans nom',
          description: p.description || '',
          price: p.price || 0,
          formattedPrice: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
          }).format(p.price || 0),
          oldPrice: oldPrice,
          formattedOldPrice: oldPrice
            ? new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'XOF',
              }).format(oldPrice)
            : null,
          discountPercentage: discountPercentage,
          image: p.image_url ?? null,
          stock: p.stock || 0,
          isInStock: (p.stock || 0) > 0,
          isLowStock: (p.stock || 0) > 0 && (p.stock || 0) <= 5,
          isNew: p.is_new || false,
          isOnSale: isOnSale,
          rating: p.rating || 0,
          reviewsCount: p.reviews_count || 0,
          sales: p.sales || 0,
          likes: p.likes || 0,
          category: p.category || null,
          user: userData,
        }
      }

      // Formater tous les produits
      const formattedProducts = allProducts.map(formatProduct)
      const formattedNewProducts = newProducts.map(formatProduct)
      const formattedOnSale = productsOnSale.map(formatProduct)
      const formattedBestSellers = bestSellers.map(formatProduct)

      // Récupérer les catégories uniques des produits
      const categoriesList = [...new Set(allProducts.map(p => p.category).filter((cat): cat is string => cat !== null && cat !== ''))]
      const formattedCategories = categoriesList.length > 0 
        ? categoriesList.map((cat, index) => ({
            id: String(index + 1),
            name: cat,
            slug: cat.toLowerCase().replace(/\s+/g, '-'),
          }))
        : [
            { id: '1', name: 'Tous les produits', slug: 'all' }
          ]

      console.log('📊 Stats:', {
        totalProducts: Number(totalProductsResult[0].$extras.total),
        formattedProductsCount: formattedProducts.length,
        categoriesCount: formattedCategories.length,
      })

      return response.json({
        success: true,
        products: formattedProducts,
        productsOnSale: formattedOnSale.length > 0 ? formattedOnSale : formattedProducts.filter(p => p.isOnSale).slice(0, 8),
        newProducts: formattedNewProducts.length > 0 ? formattedNewProducts : formattedProducts.slice(0, 8),
        bestSellers: formattedBestSellers.length > 0 ? formattedBestSellers : formattedProducts.slice(0, 8),
        activeCoupons: [],
        banners: [],
        flashSales: [],
        categoryOffers: [],
        categories: formattedCategories,
        stats: {
          totalProducts: Number(totalProductsResult[0].$extras.total),
          totalMerchants: totalMerchants,
          totalCoupons: 0,
          totalPromotions: 0,
        },
        pagination: {
          currentPage: products.currentPage,
          lastPage: products.lastPage,
          perPage: products.perPage,
          total: products.total,
          hasPrevious: products.currentPage > 1,
          hasNext: products.currentPage < products.lastPage,
        },
        filters: {
          category: category || null,
          search: search || null,
          sort: sort,
        },
      })
      
    } catch (error: unknown) {
      const err = error as Error
      console.error('❌ Shop API error:', err)
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du chargement de la boutique',
        error: err.message,
      })
    }
  }

  async apiCoupons({ response }: HttpContext) {
    return response.json({
      success: true,
      coupons: [],
    })
  }

  async apiPromotions({ response }: HttpContext) {
    return response.json({
      success: true,
      promotions: [],
    })
  }
}
