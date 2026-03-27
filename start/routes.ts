import router from '@adonisjs/core/services/router'

// Import des contrôleurs
import NewAccountController from '#controllers/new_account_controller'
import SessionController from '#controllers/session_controller'
import UsersController from '#controllers/users_controller'
import ProductsController from '#controllers/products_controller'
import CategoriesController from '#controllers/categories_controller'
import CartController from '#controllers/CartController'
import FavoritesController from '#controllers/favorites_controller'
import OrdersController from '#controllers/OrdersController'
import OrderTrackingController from '#controllers/order_trackings_controller'
import MerchantDashboardController from '#controllers/merchant_dashboard_controller'

// =======================================================
// Routes API JSON
// =======================================================

router.group(() => {
  // ----------------------
  // Auth API (public)
  // ----------------------
  router.put('/profile/update', [SessionController, 'update']).as('api.client.profile.update')
  router.post('/client/register', [NewAccountController, 'store']).as('api.client.register')
  router.post('/client/login', [SessionController, 'store']).as('api.client.login')

  // ----------------------
  // Routes protégées (auth required)
  // ----------------------
  router.group(() => {
    router.post('/client/logout', [SessionController, 'destroy']).as('api.client.logout')

    // Users
    router.get('/users', [UsersController, 'index']).as('api.users.index')
    router.get('/users/:id', [UsersController, 'show']).as('api.users.show')

    // Products
    router.get('/products', [ProductsController, 'index']).as('api.products.index')
    router.get('/products/:id', [ProductsController, 'show']).as('api.products.show')
    router.post('/products', [ProductsController, 'store']).as('api.products.store')
    router.put('/products/:id', [ProductsController, 'update']).as('api.products.update')
    router.delete('/products/:id', [ProductsController, 'destroy']).as('api.products.destroy')

    // Categories
    router.get('/categories', [CategoriesController, 'index']).as('api.categories.index')
    router.get('/categories/:slug', [CategoriesController, 'show']).as('api.categories.show')
    router.post('/categories', [CategoriesController, 'store']).as('api.categories.store')
    router.put('/categories/:id', [CategoriesController, 'update']).as('api.categories.update')
    router.delete('/categories/:id', [CategoriesController, 'destroy']).as('api.categories.destroy')

    // Création de produit dans une catégorie
    router.post(
      '/categories/:id/products',
      [CategoriesController, 'createProduct']
    ).as('api.categories.products.store')

    // ----------------------
    // Cart routes
    // ----------------------
    router.get('/cart/:userId', [CartController, 'getCart']).as('api.cart.get')
    router.post('/cart/show', [CartController, 'show']).as('api.cart.show')
    router.post('/cart/add', [CartController, 'add']).as('api.cart.add')
    router.put('/cart/update', [CartController, 'update']).as('api.cart.update')
    router.delete('/cart/item/:itemId', [CartController, 'deleteItem']).as('api.cart.delete')

    // ----------------------
    // Favorites routes
    // ----------------------
    router.post('/favorites/add', [FavoritesController, 'add']).as('api.favorites.add')
    router.post('/favorites/remove', [FavoritesController, 'remove']).as('api.favorites.remove')
    router.get('/favorites', [FavoritesController, 'index']).as('api.favorites.index')
    router.get('/favorites/check', [FavoritesController, 'check']).as('api.favorites.check')

    // ----------------------
    // Orders routes
    // ----------------------
    router.post('/orders', [OrdersController, 'store']).as('api.orders.store')
    router.get('/orders/:userId', [OrdersController, 'index']).as('api.orders.index')
    router.get('/orders/:orderId/user/:userId', [OrdersController, 'show']).as('api.orders.show')
    router.post('/orders/:orderId/cancel', [OrdersController, 'cancel']).as('api.orders.cancel')
    router.get('/orders/:orderId/invoice/:userId', [OrdersController, 'invoice']).as('api.orders.invoice')
    router.put('/orders/:orderId/status', [OrdersController, 'updateStatus']).as('api.orders.update-status')

    // ----------------------
    // Merchant Dashboard routes
    // ----------------------
    // Dashboard principal
  

    // Produits du marchand
    router.get('/merchant/products/:userId', [MerchantDashboardController, 'getProducts'])
      .as('api.merchant.products')

    // CRUD Produits du marchand
    router.post('/merchant/products/:userId', [MerchantDashboardController, 'createProduct'])
      .as('api.merchant.products.create')

    router.put('/merchant/products/:userId/:productId', [MerchantDashboardController, 'updateProduct'])
      .as('api.merchant.products.update')

    router.delete('/merchant/products/:userId/:productId', [MerchantDashboardController, 'deleteProduct'])
      .as('api.merchant.products.delete')

    // Catégories du marchand
    router.get('/merchant/categories/:userId', [MerchantDashboardController, 'getCategories'])
      .as('api.merchant.categories')

    router.post('/merchant/categories/:userId', [MerchantDashboardController, 'createCategory'])
      .as('api.merchant.categories.create')

    router.put('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'updateCategory'])
      .as('api.merchant.categories.update')

    router.delete('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'deleteCategory'])
      .as('api.merchant.categories.delete')

    // Coupons du marchand
    router.get('/merchant/coupons/:userId', [MerchantDashboardController, 'getCoupons'])
      .as('api.merchant.coupons')

    router.post('/merchant/coupons/:userId', [MerchantDashboardController, 'createCoupon'])
      .as('api.merchant.coupons.create')

    router.put('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'updateCoupon'])
      .as('api.merchant.coupons.update')

    router.delete('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'deleteCoupon'])
      .as('api.merchant.coupons.delete')

    // Statistiques rapides
    router.get('/merchant/stats/:userId', [MerchantDashboardController, 'getStats'])
      .as('api.merchant.stats')

    // Commandes récentes
    router.get('/merchant/orders/:userId', [MerchantDashboardController, 'getRecentOrders'])
      .as('api.merchant.orders')

  }) // Appliquer le middleware auth

  // ----------------------
  // Order Tracking routes (publiques)
  // ----------------------
  router.post('/tracking/search', [OrderTrackingController, 'search']).as('api.tracking.search')
  router.get('/tracking/:orderId/events', [OrderTrackingController, 'getTrackingEvents']).as('api.tracking.events')

  // ----------------------
  // Admin routes pour le suivi
  // ----------------------
  router.group(() => {
    router.post('/tracking/:orderId/event', [OrderTrackingController, 'addTrackingEvent']).as('api.tracking.add-event')
    router.put('/tracking/:orderId/status', [OrderTrackingController, 'updateOrderStatus']).as('api.tracking.update-status')
  })

}).prefix('/api')