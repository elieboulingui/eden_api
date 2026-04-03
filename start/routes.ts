import router from '@adonisjs/core/services/router'
const PubsController = () => import('#controllers/pubs_controller')
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

router.group(() => {

  router.get('/orders/:orderId/payment-status', [OrdersController, 'checkPaymentStatus']).as('orders.check_payment_status')
  router.get('/payment/status/:transactionId', [OrdersController, 'checkPaymentStatus']).as('orders.payment_status_callbacks')

    router.get('/pubs', [PubsController, 'getAllPubs'])
    router.post('/pubs', [PubsController, 'createPub'])
    router.put('/pubs/:id', [PubsController, 'updatePub'])
    router.delete('/pubs/:id', [PubsController, 'deletePub'])
    router.patch('/pubs/:id/toggle', [PubsController, 'togglePubStatus'])

  // ───────────── MERCHANT ─────────────
  router.get('/merchant/wallet/:userId', (ctx) => new MerchantDashboardController().getWallet(ctx))
  router.get('/merchant/dashboard/:userId', (ctx) => new MerchantDashboardController().dashboard(ctx))
  router.get('/merchant/stats/:userId', (ctx) => new MerchantDashboardController().getStats(ctx))

  router.get('/merchant/orders/all/:userId', (ctx) => new MerchantDashboardController().getMerchantOrders(ctx))
  router.get('/merchant/orders/pending/:userId', (ctx) => new MerchantDashboardController().getPendingOrders(ctx))
  router.get('/merchant/orders/detail/:userId/:orderId', (ctx) => new MerchantDashboardController().getOrderDetails(ctx))
  router.get('/merchant/orders/recent/:userId', (ctx) => new MerchantDashboardController().getRecentOrders(ctx))

  router.get('/merchant/products/:userId', (ctx) => new MerchantDashboardController().getProducts(ctx))
  router.post('/merchant/products/:userId', (ctx) => new MerchantDashboardController().createProduct(ctx))
  router.put('/merchant/products/:userId/:productId', (ctx) => new MerchantDashboardController().updateProduct(ctx))
  router.delete('/merchant/products/:userId/:productId', (ctx) => new MerchantDashboardController().deleteProduct(ctx))

  router.get('/merchant/categories/:userId', (ctx) => new MerchantDashboardController().getCategories(ctx))
  router.post('/merchant/categories/:userId', (ctx) => new MerchantDashboardController().createCategory(ctx))
  router.put('/merchant/categories/:userId/:categoryId', (ctx) => new MerchantDashboardController().updateCategory(ctx))
  router.delete('/merchant/categories/:userId/:categoryId', (ctx) => new MerchantDashboardController().deleteCategory(ctx))

  router.get('/merchant/coupons/:userId', (ctx) => new MerchantDashboardController().getCoupons(ctx))
  router.post('/merchant/coupons/:userId', (ctx) => new MerchantDashboardController().createCoupon(ctx))
  router.put('/merchant/coupons/:userId/:couponId', (ctx) => new MerchantDashboardController().updateCoupon(ctx))
  router.delete('/merchant/coupons/:userId/:couponId', (ctx) => new MerchantDashboardController().deleteCoupon(ctx))

  // ───────────── COUPONS ─────────────
  router.get('/coupons', (ctx) => new CouponsController().index(ctx))
  router.post('/coupons/apply', (ctx) => new CouponsController().apply(ctx))
  router.post('/coupons/verify', (ctx) => new CouponsController().verify(ctx))
  router.get('/coupons/:id', (ctx) => new CouponsController().show(ctx))

  // ───────────── AUTH ─────────────
  router.post('/client/register', (ctx) => new NewAccountController().store(ctx))
  router.post('/client/login', (ctx) => new SessionController().store(ctx))
  router.put('/profile/update', (ctx) => new SessionController().update(ctx))
  router.post('/client/logout', (ctx) => new SessionController().destroy(ctx))

  // ───────────── USERS ─────────────
  router.get('/users', (ctx) => new UsersController().index(ctx))
  router.get('/users/:id', (ctx) => new UsersController().show(ctx))

  // ───────────── PRODUCTS ─────────────
  router.get('/products', (ctx) => new ProductsController().index(ctx))
  router.get('/products/:id', (ctx) => new ProductsController().show(ctx))
  router.post('/products', (ctx) => new ProductsController().store(ctx))
  router.put('/products/:id', (ctx) => new ProductsController().update(ctx))
  router.delete('/products/:id', (ctx) => new ProductsController().destroy(ctx))

  // ───────────── CATEGORIES ─────────────
  router.get('/categories', (ctx) => new CategoriesController().index(ctx))
  router.get('/categories/:slug', (ctx) => new CategoriesController().show(ctx))
  router.post('/categories', (ctx) => new CategoriesController().store(ctx))
  router.put('/categories/:id', (ctx) => new CategoriesController().update(ctx))
  router.delete('/categories/:id', (ctx) => new CategoriesController().destroy(ctx))
  router.post('/categories/:id/products', (ctx) => new CategoriesController().createProduct(ctx))

  // ───────────── CART ─────────────
  router.get('/cart/:userId', (ctx) => new CartController().getCart(ctx))
  router.post('/cart/show', (ctx) => new CartController().show(ctx))
  router.post('/cart/add', (ctx) => new CartController().add(ctx))
  router.put('/cart/update', (ctx) => new CartController().update(ctx))
  router.delete('/cart/item/:itemId', (ctx) => new CartController().deleteItem(ctx))
  router.delete('/cart/clear', (ctx) => new CartController().clear(ctx))

  // ───────────── FAVORITES ─────────────
  router.post('/favorites/add', (ctx) => new FavoritesController().add(ctx))
  router.post('/favorites/remove', (ctx) => new FavoritesController().remove(ctx))
  router.get('/favorites', (ctx) => new FavoritesController().index(ctx))
  router.get('/favorites/check', (ctx) => new FavoritesController().check(ctx))

  // ───────────── ORDERS ─────────────
  router.post('/orders', [OrdersController, 'store'])
  router.get('/orders/:userId', [OrdersController, 'index'])
  router.get('/orders/:orderId/user/:userId', [OrdersController, 'show'])
  router.post('/orders/:orderId/cancel', [OrdersController, 'cancel'])
  router.get('/orders/:orderId/invoice/:userId', [OrdersController, 'invoice'])
  router.put('/orders/:orderId/status', [OrdersController, 'updateStatus'])

  // ───────────── TRACKING ─────────────
  router.post('/tracking/search', (ctx) => new OrderTrackingController().search(ctx))
  router.get('/tracking/:orderId/events', (ctx) => new OrderTrackingController().getTrackingEvents(ctx))
  router.post('/tracking/:orderId/event', (ctx) => new OrderTrackingController().addTrackingEvent(ctx))
  router.put('/tracking/:orderId/status', (ctx) => new OrderTrackingController().updateOrderStatus(ctx))

}).prefix('/api')
