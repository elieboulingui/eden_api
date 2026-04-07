// start/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Controllers imports
import PromotionsController from '#controllers/promotions_controller'
import PubsController from '#controllers/pubs_controller'
import NewAccountController from '#controllers/new_account_controller'
import SessionController from '#controllers/session_controller'
import NewAccountViewController from '#controllers/new_account_controllers'
import SessionViewController from '#controllers/session_controllers'
import UsersController from '#controllers/users_controller'
import ProductsController from '#controllers/products_controller'
import CategoriesController from '#controllers/categories_controller'
import CartController from '#controllers/CartController'
import FavoritesController from '#controllers/favorites_controller'
import OrdersController from '#controllers/OrdersController'
import DashboardViewController from '#controllers/dashboard_view_controller'
import NewsletterController from '#controllers/newsletter_controller'
import PushSubscriptionsController from '#controllers/push_subscriptions_controller'

// Lazy imports
const BlogController = () => import('#controllers/blog_controller')
const OrderTrackingController = () => import('#controllers/order_trackings_controller')
const MerchantDashboardController = () => import('#controllers/merchant_dashboard_controller')
const CouponsController = () => import('#controllers/coupons_controller')

// ============================================================
// ROUTES WEB (PAGES)
// ============================================================

// Page d'accueil
router.get('/', async ({ view }) => {
  return view.render('pages/home')
}).as('home')

// Routes d'authentification web
router.group(() => {
  router.get('signup', [NewAccountViewController, 'create']).as('new_account.create')
  router.post('signup', [NewAccountViewController, 'stores']).as('new_account.web.store')

  router.get('login', [SessionViewController, 'create']).as('session.create')
  router.post('login', [SessionViewController, 'stores']).as('session.store')
}).use(middleware.guest())

router.post('logout', [SessionViewController, 'destroy'])
  .as('session.web.destroy')
  .middleware([middleware.auth()])

// Dashboards web
router.group(() => {
  router.get('admin', [DashboardViewController, 'admin']).as('dashboard.admin')
  router.get('secretary', [DashboardViewController, 'secretary']).as('dashboard.secretary')
  router.get('manager', [DashboardViewController, 'manager']).as('dashboard.manager')
  router.get('promotions', [DashboardViewController, 'promotions']).as('dashboard.promotions')
}).prefix('dashboards')

// ============================================================
// ROUTES API
// ============================================================

router.group(() => {

  // ----------------------------------------------------------
  // AUTHENTIFICATION
  // ----------------------------------------------------------
  router.post('/client/register', [NewAccountController, 'store']).as('new_account.store')
  router.post('/client/login', [SessionController, 'store']).as('session.client.store')
  router.post('/login', [SessionController, 'store']).as('session.login')
  router.post('/api/login', [SessionController, 'store']).as('session.api.login')
  router.post('/client/logout', [SessionController, 'destroy'])

  // ✅ ROUTES PROFIL
  router.put('/profile/update', [SessionController, 'update'])
  router.put('/profile/password', [SessionController, 'changePassword'])

  // ----------------------------------------------------------
  // BLOG (PUBLIC)
  // ----------------------------------------------------------
  router.get('/blog/posts', [BlogController, 'index'])
  router.get('/blog/posts/featured', [BlogController, 'featured'])
  router.get('/blog/posts/:slug', [BlogController, 'show'])

  // ----------------------------------------------------------
  // PRODUITS
  // ----------------------------------------------------------
  router.get('/products', [ProductsController, 'index'])
  router.get('/products/:id', [ProductsController, 'show']).as('products.show')
  router.get('/produits/:id', [ProductsController, 'show']).as('produits.show')
  router.post('/products', [ProductsController, 'store'])
  router.put('/products/:id', [ProductsController, 'update'])
  router.delete('/products/:id', [ProductsController, 'destroy'])

  // ----------------------------------------------------------
  // CATÉGORIES
  // ----------------------------------------------------------
  router.get('/categories', [CategoriesController, 'index'])
  router.get('/categories/:name', [CategoriesController, 'show'])
  router.post('/categories', [CategoriesController, 'store'])
  router.put('/categories/:id', [CategoriesController, 'update'])
  router.delete('/categories/:id', [CategoriesController, 'destroy'])
  router.post('/categories/:id/products', [CategoriesController, 'createProduct'])

  // ----------------------------------------------------------
  // UTILISATEURS
  // ----------------------------------------------------------
  router.get('/users', [UsersController, 'index'])
  router.get('/users/:id', [UsersController, 'show'])

  // ----------------------------------------------------------
  // PANIER
  // ----------------------------------------------------------
  router.get('/cart/:userId', [CartController, 'getCart'])
  router.post('/cart/show', [CartController, 'show'])
  router.post('/cart/add', [CartController, 'add'])
  router.put('/cart/update', [CartController, 'update'])
  router.delete('/cart/item/:itemId', [CartController, 'deleteItem'])
  router.delete('/cart/clear', [CartController, 'clear'])

  // ----------------------------------------------------------
  // FAVORIS
  // ----------------------------------------------------------
  router.post('/favorites/add', [FavoritesController, 'add'])
  router.post('/favorites/remove', [FavoritesController, 'remove'])
  router.get('/favorites', [FavoritesController, 'index'])
  router.get('/favorites/check', [FavoritesController, 'check'])

  // ----------------------------------------------------------
  // COMMANDES
  // ----------------------------------------------------------
  router.post('/orders', [OrdersController, 'store'])
  router.get('/orders/all', [OrdersController, 'allOrders'])
  router.get('/orders/:userId', [OrdersController, 'index'])
  router.get('/orders/:orderId/user/:userId', [OrdersController, 'show'])
  router.post('/orders/:orderId/cancel', [OrdersController, 'cancel'])
  router.get('/orders/:orderId/invoice/:userId', [OrdersController, 'invoice'])
  router.put('/orders/:orderId/status', [OrdersController, 'updateStatus'])
  // ✅ CORRECTION: checkPaymentStatus (avec un 's' à la fin)
  router.get('/orders/:orderId/payment-status', [OrdersController, 'checkPaymentStatus'])
  router.get('/payment/status/:transactionId', [OrdersController, 'checkPaymentStatus'])

  // ----------------------------------------------------------
  // SUIVI DE COMMANDE
  // ----------------------------------------------------------
  router.post('/tracking/search', [OrderTrackingController, 'search'])
  router.get('/tracking/:orderId/events', [OrderTrackingController, 'getTrackingEvents'])
  router.post('/tracking/:orderId/event', [OrderTrackingController, 'addTrackingEvent'])
  router.put('/tracking/:orderId/status', [OrderTrackingController, 'updateOrderStatus'])

  // ----------------------------------------------------------
  // COUPONS (PUBLIC)
  // ----------------------------------------------------------
  router.get('/coupons', [CouponsController, 'getAllCoupons'])
  router.post('/coupons/apply', [CouponsController, 'apply'])
  router.post('/coupons/verify', [CouponsController, 'verify'])
  router.get('/coupons/:id', [CouponsController, 'show'])

  // ----------------------------------------------------------
  // PROMOTIONS
  // ----------------------------------------------------------
  router.get('/promo', [PromotionsController, 'index'])
  router.get('/banners', [PromotionsController, 'banners'])
  router.get('/flash-sales', [PromotionsController, 'flashSales'])
  router.get('/promo/:id', [PromotionsController, 'show'])
  router.post('/promo', [PromotionsController, 'store'])
  router.put('/promo/:id', [PromotionsController, 'update'])
  router.delete('/promo/:id', [PromotionsController, 'destroy'])

  // ----------------------------------------------------------
  // PUBS
  // ----------------------------------------------------------
  router.get('/pubs', [PubsController, 'getAllPubs'])
  router.post('/pubs', [PubsController, 'createPub'])
  router.put('/pubs/:id', [PubsController, 'updatePub'])
  router.delete('/pubs/:id', [PubsController, 'deletePub'])
  router.patch('/pubs/:id/toggle', [PubsController, 'togglePubStatus'])

  // ----------------------------------------------------------
  // NEWSLETTER
  // ----------------------------------------------------------
  router.post('/newsletter/subscribe', [NewsletterController, 'store'])

  // ----------------------------------------------------------
  // PUSH SUBSCRIPTIONS
  // ----------------------------------------------------------
  router.get('/push-subscriptions', [PushSubscriptionsController, 'index'])
  router.post('/push-subscriptions', [PushSubscriptionsController, 'store'])
  router.delete('/push-subscriptions/:id', [PushSubscriptionsController, 'destroy'])

  // ----------------------------------------------------------
  // MARCHAND (MERCHANT)
  // ----------------------------------------------------------
  router.post('/merchant/give-change', [MerchantDashboardController, 'giveChange'])
    router.get('/merchant/withdrawals/:userId', [
      MerchantDashboardController,
      'getWithdrawalHistory',
    ])
  router.get('/merchant/wallet/:userId', [MerchantDashboardController, 'getWallet'])
  router.get('/merchant/dashboard/:userId', [MerchantDashboardController, 'dashboard'])
  router.get('/merchant/stats/:userId', [MerchantDashboardController, 'getStats'])

  router.get('/merchant/orders/all/:userId', [MerchantDashboardController, 'getMerchantOrders'])
  router.get('/merchant/orders/pending/:userId', [MerchantDashboardController, 'getPendingOrders'])
  router.get('/merchant/orders/detail/:userId/:orderId', [MerchantDashboardController, 'getOrderDetails'])
  router.get('/merchant/orders/recent/:userId', [MerchantDashboardController, 'getRecentOrders'])

  router.get('/merchant/products/:userId', [MerchantDashboardController, 'getProducts'])
  router.post('/merchant/products/:userId', [MerchantDashboardController, 'createProduct'])
  router.put('/merchant/products/:userId/:productId', [MerchantDashboardController, 'updateProduct'])
  router.delete('/merchant/products/:userId/:productId', [MerchantDashboardController, 'deleteProduct'])

  router.get('/merchant/categories/:userId', [MerchantDashboardController, 'getCategories'])
  router.post('/merchant/categories/:userId', [MerchantDashboardController, 'createCategory'])
  router.put('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'updateCategory'])
  router.delete('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'deleteCategory'])

  router.get('/merchant/coupons/:userId', [MerchantDashboardController, 'getCoupons'])
  router.post('/merchant/coupons/:userId', [MerchantDashboardController, 'createCoupon'])
  router.put('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'updateCoupon'])
  router.delete('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'deleteCoupon'])

  // ----------------------------------------------------------
  // BLOG ADMIN
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/posts', [BlogController, 'adminIndex'])
    router.get('/posts/stats', [BlogController, 'stats'])
    router.get('/posts/:id', [BlogController, 'adminShow'])
    router.post('/posts', [BlogController, 'store'])
    router.put('/posts/:id', [BlogController, 'update'])
    router.delete('/posts/:id', [BlogController, 'destroy'])
  }).prefix('/blog/admin')

}).prefix('/api')