import router from '@adonisjs/core/services/router'
import PubsController from '#controllers/pubs_controller'
import NewAccountController from '#controllers/new_account_controller'
import SessionController from '#controllers/session_controller'
import NewAccountViewController from '#controllers/new_account_controllers'
import SessionViewController from '#controllers/session_controllers'
import UsersController from '#controllers/users_controller'
import ProductsController from '#controllers/products_controller'
import CategoriesController from '#controllers/categories_controller'
import CartController from '#controllers/CartController'
import { middleware } from '#start/kernel'
import FavoritesController from '#controllers/favorites_controller'
import OrdersController from '#controllers/OrdersController'
import DashboardViewController from '#controllers/dashboard_view_controller'
const CouponsController = () => import('#controllers/coupons_controller')
const OrderTrackingController = () => import('#controllers/order_trackings_controller')
const MerchantDashboardController = () => import('#controllers/merchant_dashboard_controller')

// Page d'accueil (corrigez aussi cette ligne)
router.get('/', async ({ view }) => {
  return view.render('pages/home')
}).as('home')

// Routes d'authentification - utilisez les contrôleurs directement
router.group(() => {
  router.get('signup', [NewAccountViewController, 'create'])
  router.post('signup', [NewAccountViewController, 'stores'])

  router.get('login', [SessionViewController, 'create']).as('session.create')
  router.post('login', [SessionViewController, 'stores']).as('session.store')
}).use(middleware.guest())

router.group(() => {
  router.get('admin', [DashboardViewController, 'admin']).as('dashboard.admin')
  router.get('secretary', [DashboardViewController, 'secretary']).as('dashboard.secretary')
  router.get('manager', [DashboardViewController, 'manager']).as('dashboard.manager')
  router.get('promotions', [DashboardViewController, 'promotions']).as('dashboard.promotions')
})
  .prefix('dashboards')


// Routes API
router.group(() => {
  router.get('/orders/:orderId/payment-status', [OrdersController, 'checkPaymentStatus']).as(
    'orders.check_payment_status'
  )
  router.get('/payment/status/:transactionId', [OrdersController, 'checkPaymentStatus']).as(
    'orders.payment_status_callbacks'
  )

  router.get('/pubs', [PubsController, 'getAllPubs'])
  router.post('/pubs', [PubsController, 'createPub'])
  router.put('/pubs/:id', [PubsController, 'updatePub'])
  router.delete('/pubs/:id', [PubsController, 'deletePub'])
  router.patch('/pubs/:id/toggle', [PubsController, 'togglePubStatus'])

  router.post('/merchant/give-change', [MerchantDashboardController, 'giveChange'])
  router.get('/merchant/withdrawals/:userId', [MerchantDashboardController, 'getWithdrawalHistory'])
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

  router.get('/coupons', [CouponsController, 'index'])
  router.post('/coupons/apply', [CouponsController, 'apply'])
  router.post('/coupons/verify', [CouponsController, 'verify'])
  router.get('/coupons/:id', [CouponsController, 'show'])

  router.post('/client/register', [NewAccountController, 'store'])
  router.post('/client/login', [SessionController, 'store']).as('session.client.store')
  router.post('/login', [SessionController, 'store']).as('session.login')
  router.post('/api/login', [SessionController, 'store']).as('session.api.login')
  router.put('/profile/update', [SessionController, 'update'])
  router.post('/client/logout', [SessionController, 'destroy'])

  router.get('/users', [UsersController, 'index'])
  router.get('/users/:id', [UsersController, 'show'])

  router.get('/products', [ProductsController, 'index'])
  router.get('/products/:id', [ProductsController, 'show']).as('products.show')
  router.get('/produits/:id', [ProductsController, 'show']).as('produits.show')
  router.post('/products', [ProductsController, 'store'])
  router.put('/products/:id', [ProductsController, 'update'])
  router.delete('/products/:id', [ProductsController, 'destroy'])

  router.get('/categories', [CategoriesController, 'index'])
  router.get('/categories/:slug', [CategoriesController, 'show'])
  router.post('/categories', [CategoriesController, 'store'])
  router.put('/categories/:id', [CategoriesController, 'update'])
  router.delete('/categories/:id', [CategoriesController, 'destroy'])
  router.post('/categories/:id/products', [CategoriesController, 'createProduct'])

  router.get('/cart/:userId', [CartController, 'getCart'])
  router.post('/cart/show', [CartController, 'show'])
  router.post('/cart/add', [CartController, 'add'])
  router.put('/cart/update', [CartController, 'update'])
  router.delete('/cart/item/:itemId', [CartController, 'deleteItem'])
  router.delete('/cart/clear', [CartController, 'clear'])

  router.post('/favorites/add', [FavoritesController, 'add'])
  router.post('/favorites/remove', [FavoritesController, 'remove'])
  router.get('/favorites', [FavoritesController, 'index'])
  router.get('/favorites/check', [FavoritesController, 'check'])

  router.post('/orders', [OrdersController, 'store'])
  router.get('/orders/all', [OrdersController, 'allOrders'])
  router.get('/orders/:userId', [OrdersController, 'index'])
  router.get('/orders/:orderId/user/:userId', [OrdersController, 'show'])
  router.post('/orders/:orderId/cancel', [OrdersController, 'cancel'])
  router.get('/orders/:orderId/invoice/:userId', [OrdersController, 'invoice'])
  router.put('/orders/:orderId/status', [OrdersController, 'updateStatus'])

  router.post('/tracking/search', [OrderTrackingController, 'search'])
  router.get('/tracking/:orderId/events', [OrderTrackingController, 'getTrackingEvents'])
  router.post('/tracking/:orderId/event', [OrderTrackingController, 'addTrackingEvent'])
  router.put('/tracking/:orderId/status', [OrderTrackingController, 'updateOrderStatus'])
}).prefix('/api')
