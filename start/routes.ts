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

const CouponsController = () => import('#controllers/coupons_controller')

// =======================================================
// Routes API
// =======================================================
router.group(() => {

  // ── Auth (public) ──────────────────────────────────
  router.post('/client/register', [NewAccountController, 'store']).as('api.client.register')
  router.post('/client/login', [SessionController, 'store']).as('api.client.login')
  router.get('/merchant/orders/:id', [MerchantDashboardController, 'index'])
  // ── Order Tracking (public) ────────────────────────
  router.post('/tracking/search', [OrderTrackingController, 'search']).as('api.tracking.search')
  router.get('/tracking/:orderId/events', [OrderTrackingController, 'getTrackingEvents']).as('api.tracking.events')

  // ── Routes protégées (auth required) ──────────────
  router.group(() => {

    // Profile & Auth
    router.put('/profile/update', [SessionController, 'update']).as('api.client.profile.update')
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
    router.post('/categories/:id/products', [CategoriesController, 'createProduct']).as('api.categories.products.store')

    // Cart
    router.get('/cart/:userId', [CartController, 'getCart']).as('api.cart.get')
    router.post('/cart/show', [CartController, 'show']).as('api.cart.show')
    router.post('/cart/add', [CartController, 'add']).as('api.cart.add')
    router.put('/cart/update', [CartController, 'update']).as('api.cart.update')
    router.delete('/cart/item/:itemId', [CartController, 'deleteItem']).as('api.cart.delete')

    // Favorites
    router.post('/favorites/add', [FavoritesController, 'add']).as('api.favorites.add')
    router.post('/favorites/remove', [FavoritesController, 'remove']).as('api.favorites.remove')
    router.get('/favorites', [FavoritesController, 'index']).as('api.favorites.index')
    router.get('/favorites/check', [FavoritesController, 'check']).as('api.favorites.check')

    // Orders
    router.post('/orders', [OrdersController, 'store']).as('api.orders.store')
    router.get('/orders/:userId', [OrdersController, 'index']).as('api.orders.index')
    router.get('/orders/:orderId/user/:userId', [OrdersController, 'show']).as('api.orders.show')
    router.post('/orders/:orderId/cancel', [OrdersController, 'cancel']).as('api.orders.cancel')
    router.get('/orders/:orderId/invoice/:userId', [OrdersController, 'invoice']).as('api.orders.invoice')
    router.put('/orders/:orderId/status', [OrdersController, 'updateStatus']).as('api.orders.update-status')

    // ── Merchant Dashboard ─────────────────────────
    router.group(() => {

      // Dashboard
      router.get('/dashboard/:userId', [MerchantDashboardController, 'dashboard']).as('api.merchant.dashboard')
      router.get('/stats/:userId', [MerchantDashboardController, 'getStats']).as('api.merchant.stats')
      router.get('/orders/:userId', [MerchantDashboardController, 'getRecentOrders']).as('api.merchant.orders')

      // Produits
      router.get('/products/:userId', [MerchantDashboardController, 'getProducts']).as('api.merchant.products')
      router.post('/products/:userId', [MerchantDashboardController, 'createProduct']).as('api.merchant.products.create')
      router.put('/products/:userId/:productId', [MerchantDashboardController, 'updateProduct']).as('api.merchant.products.update')
      router.delete('/products/:userId/:productId', [MerchantDashboardController, 'deleteProduct']).as('api.merchant.products.delete')

      // Catégories
      router.get('/categories/:userId', [MerchantDashboardController, 'getCategories']).as('api.merchant.categories')
      router.post('/categories/:userId', [MerchantDashboardController, 'createCategory']).as('api.merchant.categories.create')
      router.put('/categories/:userId/:categoryId', [MerchantDashboardController, 'updateCategory']).as('api.merchant.categories.update')
      router.delete('/categories/:userId/:categoryId', [MerchantDashboardController, 'deleteCategory']).as('api.merchant.categories.delete')

      // Coupons
      router.get('/coupons/:userId', [MerchantDashboardController, 'getCoupons']).as('api.merchant.coupons')
      router.post('/coupons/:userId', [MerchantDashboardController, 'createCoupon']).as('api.merchant.coupons.create')
      router.put('/coupons/:userId/:couponId', [MerchantDashboardController, 'updateCoupon']).as('api.merchant.coupons.update')
      router.delete('/coupons/:userId/:couponId', [MerchantDashboardController, 'deleteCoupon']).as('api.merchant.coupons.delete')

      // Coupons publics (CouponsController)
      router.get('/coupons', CouponsController, 'index').as('api.coupons.index')
      router.get('/coupons/verify/:code', CouponsController, 'verify').as('api.coupons.verify')
      router.get('/coupons/:id', CouponsController, 'show').as('api.coupons.show')

    }).prefix('/merchant')

    // ── Order Tracking Admin ───────────────────────
    router.group(() => {
      router.post('/tracking/:orderId/event', [OrderTrackingController, 'addTrackingEvent']).as('api.tracking.add-event')
      router.put('/tracking/:orderId/status', [OrderTrackingController, 'updateOrderStatus']).as('api.tracking.update-status')
    })

  })

}).prefix('/api')
