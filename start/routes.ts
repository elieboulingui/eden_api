import router from '@adonisjs/core/services/router'
import PubsController from '#controllers/pubs_controller'
import NewAccountController from '#controllers/new_account_controller'
import SessionController from '#controllers/session_controller'
import UsersController from '#controllers/users_controller'
import ProductsController from '#controllers/products_controller'
import CategoriesController from '#controllers/categories_controller'
import CartController from '#controllers/CartController'
import FavoritesController from '#controllers/favorites_controller'
import OrdersController from '#controllers/OrdersController'
import CouponsController from '#controllers/coupons_controller'
import OrderTrackingController from '#controllers/order_trackings_controller'
import MerchantDashboardController from '#controllers/merchant_dashboard_controller'
import PagesController from '#controllers/PagesController'

router.get('/', (ctx) => new PagesController().home(ctx))

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
//
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
  router.post('/client/login', [SessionController, 'store'])
  router.put('/profile/update', [SessionController, 'update'])
  router.post('/client/logout', [SessionController, 'destroy'])

  router.get('/users', [UsersController, 'index'])
  router.get('/users/:id', [UsersController, 'show'])

  router.get('/products', [ProductsController, 'index'])
  router.get('/products/:id', [ProductsController, 'show'])
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
