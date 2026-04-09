// start/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Controllers imports
import PromotionsController from '#controllers/promotions_controller'
import PubsController from '#controllers/pubs_controller'
import TestimonialsController from '#controllers/testimonials_controller'
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

  // ROUTES PROFIL
  router.put('/profile/update', [SessionController, 'update']).as('profile.update')
  router.put('/profile/password', [SessionController, 'changePassword']).as('profile.password')

  // ----------------------------------------------------------
  // BLOG (PUBLIC)
  // ----------------------------------------------------------
  router.get('/blog/posts', [BlogController, 'index']).as('blog.index')
  router.get('/blog/posts/featured', [BlogController, 'featured']).as('blog.featured')
  router.get('/blog/posts/:slug', [BlogController, 'show']).as('blog.show')
  router.post('/blog/posts/submit', [BlogController, 'publicStore']).as('blog.submit')

  // ----------------------------------------------------------
  // TESTIMONIALS (TÉMOIGNAGES)
  // ----------------------------------------------------------
  router.get('/testimonials', [TestimonialsController, 'index']).as('testimonials.index')
  router.post('/testimonials', [TestimonialsController, 'store']).as('testimonials.store')
  router.get('/testimonials/:id', [TestimonialsController, 'show']).as('testimonials.show')
  router.put('/testimonials/:id', [TestimonialsController, 'update']).as('testimonials.update')
  router.delete('/testimonials/:id', [TestimonialsController, 'destroy']).as('testimonials.destroy')

  // ----------------------------------------------------------
  // PRODUITS
  // ----------------------------------------------------------
  router.get('/products', [ProductsController, 'index']).as('products.index')
  router.get('/products/:id', [ProductsController, 'show']).as('products.show')
  router.get('/produits/:id', [ProductsController, 'show']).as('produits.show')
  router.post('/products', [ProductsController, 'store']).as('products.store')
  router.put('/products/:id', [ProductsController, 'update']).as('products.update')
  router.delete('/products/:id', [ProductsController, 'destroy']).as('products.destroy')

  // ----------------------------------------------------------
  // CATÉGORIES
  // ----------------------------------------------------------
  router.get('/categories', [CategoriesController, 'index']).as('categories.index')
  router.get('/categories/:name', [CategoriesController, 'show']).as('categories.show')
  router.post('/categories', [CategoriesController, 'store']).as('categories.store')
  router.put('/categories/:id', [CategoriesController, 'update']).as('categories.update')
  router.delete('/categories/:id', [CategoriesController, 'destroy']).as('categories.destroy')
  router.post('/categories/:id/products', [CategoriesController, 'createProduct']).as('categories.products.create')

  // ----------------------------------------------------------
  // UTILISATEURS
  // ----------------------------------------------------------
  router.get('/users', [UsersController, 'index']).as('users.index')
  router.get('/users/:id', [UsersController, 'show']).as('users.show')

  // ----------------------------------------------------------
  // PANIER
  // ----------------------------------------------------------
  router.get('/cart/:userId', [CartController, 'getCart']).as('cart.get')
  router.post('/cart/show', [CartController, 'show']).as('cart.show')
  router.post('/cart/add', [CartController, 'add']).as('cart.add')
  router.put('/cart/update', [CartController, 'update']).as('cart.update')
  router.delete('/cart/item/:itemId', [CartController, 'deleteItem']).as('cart.item.delete')
  router.delete('/cart/clear', [CartController, 'clear']).as('cart.clear')

  // ----------------------------------------------------------
  // FAVORIS
  // ----------------------------------------------------------
  router.post('/favorites/add', [FavoritesController, 'add']).as('favorites.add')
  router.post('/favorites/remove', [FavoritesController, 'remove']).as('favorites.remove')
  router.get('/favorites', [FavoritesController, 'index']).as('favorites.index')
  router.get('/favorites/check', [FavoritesController, 'check']).as('favorites.check')

  // ----------------------------------------------------------
  // COMMANDES
  // ----------------------------------------------------------
  router.post('/orders', [OrdersController, 'store']).as('orders.store')
  router.get('/orders/all', [OrdersController, 'allOrders']).as('orders.all')
  router.get('/orders/:userId', [OrdersController, 'index']).as('orders.user.index')
  router.get('/orders/:orderId/user/:userId', [OrdersController, 'show']).as('orders.show')
  router.post('/orders/:orderId/cancel', [OrdersController, 'cancel']).as('orders.cancel')
  router.get('/orders/:orderId/invoice/:userId', [OrdersController, 'invoice']).as('orders.invoice')
  router.put('/orders/:orderId/status', [OrdersController, 'updateStatus']).as('orders.status.update')

  // ✅ API PONT VERS MYPVIT - Récupérer les données sans ID (pour test/debug)
  router.get('/give-all-without-id', [OrdersController, 'giveAllWithoutId']).as('payment.without-id')

  // ✅ API pour vérifier le statut d'un paiement par reference_id
  router.get('/payment/status/:referenceId', [OrdersController, 'checkPaymentStatus']).as('payment.status')

  // Alias pour compatibilité
  router.get('/orders/:orderId/payment-status', [OrdersController, 'checkPaymentStatus']).as('orders.payment-status')

  // ----------------------------------------------------------
  // SUIVI DE COMMANDE
  // ----------------------------------------------------------
  router.post('/tracking/search', [OrderTrackingController, 'search']).as('tracking.search')
  router.get('/tracking/:orderId/events', [OrderTrackingController, 'getTrackingEvents']).as('tracking.events')
  router.post('/tracking/:orderId/event', [OrderTrackingController, 'addTrackingEvent']).as('tracking.event.add')
  router.put('/tracking/:orderId/status', [OrderTrackingController, 'updateOrderStatus']).as('tracking.status.update')

  // ----------------------------------------------------------
  // COUPONS (PUBLIC)
  // ----------------------------------------------------------
  router.get('/coupons', [CouponsController, 'getAllCoupons']).as('coupons.index')
  router.post('/coupons/apply', [CouponsController, 'apply']).as('coupons.apply')
  router.post('/coupons/verify', [CouponsController, 'verify']).as('coupons.verify')
  router.get('/coupons/:id', [CouponsController, 'show']).as('coupons.show')

  // ----------------------------------------------------------
  // PROMOTIONS
  // ----------------------------------------------------------
  router.get('/promo', [PromotionsController, 'index']).as('promo.index')
  router.get('/banners', [PromotionsController, 'banners']).as('banners.index')
  router.get('/flash-sales', [PromotionsController, 'flashSales']).as('flash-sales.index')
  router.get('/promo/:id', [PromotionsController, 'show']).as('promo.show')
  router.post('/promo', [PromotionsController, 'store']).as('promo.store')
  router.put('/promo/:id', [PromotionsController, 'update']).as('promo.update')
  router.delete('/promo/:id', [PromotionsController, 'destroy']).as('promo.destroy')

  // ----------------------------------------------------------
  // PUBS
  // ----------------------------------------------------------
  router.get('/pubs', [PubsController, 'getAllPubs']).as('pubs.index')
  router.post('/pubs', [PubsController, 'createPub']).as('pubs.store')
  router.put('/pubs/:id', [PubsController, 'updatePub']).as('pubs.update')
  router.delete('/pubs/:id', [PubsController, 'deletePub']).as('pubs.destroy')
  router.patch('/pubs/:id/toggle', [PubsController, 'togglePubStatus']).as('pubs.toggle')

  // ----------------------------------------------------------
  // NEWSLETTER
  // ----------------------------------------------------------
  router.post('/newsletter/subscribe', [NewsletterController, 'store']).as('newsletter.subscribe')

  // ----------------------------------------------------------
  // PUSH SUBSCRIPTIONS
  // ----------------------------------------------------------
  router.get('/push-subscriptions', [PushSubscriptionsController, 'index']).as('push.index')
  router.post('/push-subscriptions', [PushSubscriptionsController, 'store']).as('push.store')
  router.delete('/push-subscriptions/:id', [PushSubscriptionsController, 'destroy']).as('push.destroy')

  // ----------------------------------------------------------
  // MARCHAND (MERCHANT)
  // ----------------------------------------------------------
  router.post('/merchant/give-change', [MerchantDashboardController, 'giveChange']).as('merchant.withdraw')
  router.get('/merchant/withdrawals/:userId', [MerchantDashboardController, 'getWithdrawalHistory']).as('merchant.withdrawals')
  router.get('/merchant/wallet/:userId', [MerchantDashboardController, 'getWallet']).as('merchant.wallet')
  router.get('/merchant/dashboard/:userId', [MerchantDashboardController, 'dashboard']).as('merchant.dashboard')
  router.get('/merchant/stats/:userId', [MerchantDashboardController, 'getStats']).as('merchant.stats')

  router.get('/merchant/orders/all/:userId', [MerchantDashboardController, 'getMerchantOrders']).as('merchant.orders.all')
  router.get('/merchant/orders/pending/:userId', [MerchantDashboardController, 'getPendingOrders']).as('merchant.orders.pending')
  router.get('/merchant/orders/detail/:userId/:orderId', [MerchantDashboardController, 'getOrderDetails']).as('merchant.orders.detail')
  router.get('/merchant/orders/recent/:userId', [MerchantDashboardController, 'getRecentOrders']).as('merchant.orders.recent')

  router.get('/merchant/products/:userId', [MerchantDashboardController, 'getProducts']).as('merchant.products.index')
  router.post('/merchant/products/:userId', [MerchantDashboardController, 'createProduct']).as('merchant.products.store')
  router.put('/merchant/products/:userId/:productId', [MerchantDashboardController, 'updateProduct']).as('merchant.products.update')
  router.delete('/merchant/products/:userId/:productId', [MerchantDashboardController, 'deleteProduct']).as('merchant.products.destroy')

  router.get('/merchant/categories/:userId', [MerchantDashboardController, 'getCategories']).as('merchant.categories.index')
  router.post('/merchant/categories/:userId', [MerchantDashboardController, 'createCategory']).as('merchant.categories.store')
  router.put('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'updateCategory']).as('merchant.categories.update')
  router.delete('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'deleteCategory']).as('merchant.categories.destroy')

  router.get('/merchant/coupons/:userId', [MerchantDashboardController, 'getCoupons']).as('merchant.coupons.index')
  router.post('/merchant/coupons/:userId', [MerchantDashboardController, 'createCoupon']).as('merchant.coupons.store')
  router.put('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'updateCoupon']).as('merchant.coupons.update')
  router.delete('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'deleteCoupon']).as('merchant.coupons.destroy')

  // ----------------------------------------------------------
  // BLOG ADMIN
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/posts', [BlogController, 'adminIndex']).as('admin.posts.index')
    router.get('/posts/stats', [BlogController, 'stats']).as('admin.posts.stats')
    router.get('/posts/:id', [BlogController, 'adminShow']).as('admin.posts.show')
    router.post('/posts', [BlogController, 'store']).as('admin.posts.store')
    router.put('/posts/:id', [BlogController, 'update']).as('admin.posts.update')
    router.delete('/posts/:id', [BlogController, 'destroy']).as('admin.posts.destroy')
  }).prefix('/blog/admin')

}).prefix('/api') // ✅ Fin du groupe API