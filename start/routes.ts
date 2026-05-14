// start/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Controllers imports
const ContractsController = () => import('#controllers/ContractsController')
const MerchantDeliveryController = () => import('#controllers/MerchantDeliveryController')
const CheckoutController = () => import('#controllers/checkout_controller')
const CheckStatusController = () => import('#controllers/payments/check_status_controller')
const PayLinkSubscriptionController = () => import('#controllers/PayLinkSubscriptionController')
import SubscriptionQRController from '#controllers/SubscriptionQRController'
const SubscriptionQR = new SubscriptionQRController()
import CallbacksController from '#controllers/CallbacksController'
const RetraitController = () => import('#controllers/retraitController')
const ProductController = () => import('#controllers/product_controller')
import RenduMoneyCallbackController from '#controllers/RenduMoneyCallbackController'
const RenduMoneyCallback = new RenduMoneyCallbackController()
import SubscriptionController from '#controllers/SubscriptionController'
const Subscription = new SubscriptionController()
import SubscriptionCallbackController from '#controllers/SubscriptionCallbackController'
const SubscriptionCallback = new SubscriptionCallbackController()
import CheckPaymentStatusController from '#controllers/CheckPaymentStatusController'
import PayPalController from '#controllers/paypal_controller'
import RefundsController from '#controllers/refunds_controller'
const CallbackController = () => import('#controllers/CallbackController')
const PayMobileMoneyController = () => import('#controllers/PayMobileMoneyController')
const PayQRCodeController = () => import('#controllers/PayQRCodeController')
const PayLinkController = () => import('#controllers/PayLinkController')
const MypvitController = () => import('#controllers/MypvitController')
const KYCsController = () => import('#controllers/kycs_controller')
const ShopController = () => import('#controllers/shop_controller')
const OtpController = () => import('#controllers/OtpController')
const ContactsController = () => import('#controllers/contacts_controller')
import MerchantsController from '#controllers/merchants_controller'
import PromotionsController from '#controllers/promotions_controller'
import PubsController from '#controllers/pubs_controller'
import TestimonialsController from '#controllers/testimonials_controller'
import NewAccountController from '#controllers/new_account_controller'
import SessionController from '#controllers/session_controller'
import UsersController from '#controllers/users_controller'
import ProductsController from '#controllers/products_controller'
import CategoriesController from '#controllers/categories_controller'
import CartController from '#controllers/CartController'
import FavoritesController from '#controllers/favorites_controller'
import OrdersController from '#controllers/OrdersController'
import DashboardViewController from '#controllers/dashboard_view_controller'
import NewsletterController from '#controllers/newsletter_controller'
import PushSubscriptionsController from '#controllers/push_subscriptions_controller'
import ReviewsController from '#controllers/reviews_controller'
import HomeController from '#controllers/home_controller'

// Lazy imports
const BlogController = () => import('#controllers/blog_controller')
const OrderTrackingController = () => import('#controllers/order_trackings_controller')
const MerchantDashboardController = () => import('#controllers/merchant_dashboard_controller')
const CouponsController = () => import('#controllers/coupons_controller')
const GiveChangeController = () => import('#controllers/give_change_controller')
const HotelsController = () => import('#controllers/hotels_controller')
const RoomsController = () => import('#controllers/rooms_controller')

// ============================================================
// ROUTES WEB (PAGES)
// ============================================================

// Page d'accueil
router.get('/', [HomeController, 'index']).as('home')
router.get('/product/:id', [ProductsController, 'showWeb']).as('product.show')

// Routes d'authentification web
router.group(() => {
  router.get('signup', async ({ view }) => {
    return view.render('pages/auth/signup')
  }).as('new_account.create')

  router.post('signup', [NewAccountController, 'store']).as('new_account.web.store')

  router.get('login', async ({ view }) => {
    return view.render('pages/auth/login')
  }).as('session.create')

  router.post('login', [SessionController, 'store']).as('session.web.store')
}).use(middleware.guest())

router.post('logout', [SessionController, 'destroy'])
  .as('session.web.destroy')
  .middleware([middleware.auth()])

// Dashboards web
router.group(() => {
  router.get('paypal', [DashboardViewController, 'paypal']).as('dashboard.paypal')
  router.get('refund/:id', [DashboardViewController, 'refundDetails']).as('dashboard.refund.details')
  router.get('refund', [DashboardViewController, 'refund']).as('dashboard.refund')
  router.get('admin', [DashboardViewController, 'admin']).as('dashboard.admin')
  router.get('secretary', [DashboardViewController, 'secretary']).as('dashboard.secretary')
  router.get('manager', [DashboardViewController, 'manager']).as('dashboard.manager')
  router.get('promotions', [DashboardViewController, 'promotions']).as('dashboard.promotions')
  router.get('subscriptions', [DashboardViewController, 'subscriptions']).as('dashboard.subscriptions')
  router.get('subscriptions/:id', [DashboardViewController, 'subscriptionDetails']).as('dashboard.subscription.details')
  router.get('api/subscriptions/all', [DashboardViewController, 'apiGetAllSubscriptions']).as('api.subscriptions.all')
  router.get('api/subscriptions/merchant/:userId', [DashboardViewController, 'apiGetMerchantSubscriptions']).as('api.subscriptions.merchant')
  router.get('api/subscriptions/stats', [DashboardViewController, 'apiGetSubscriptionStats']).as('api.subscriptions.stats')
}).prefix('dashboards')

// ============================================================
// ROUTES API
// ============================================================

router.group(() => {

  // ----------------------------------------------------------
  // AUTHENTIFICATION
  // ----------------------------------------------------------
  router.post('/client/register', [NewAccountController, 'store']).as('api.register')
  router.post('/client/login', [SessionController, 'store']).as('api.login')
  router.post('/login', [SessionController, 'store']).as('api.login.simple')
  router.post('/client/logout', [SessionController, 'destroy']).as('api.logout')
  router.put('/profile/update', [SessionController, 'update']).as('api.profile.update')
  router.put('/profile/password', [SessionController, 'changePassword']).as('api.profile.password')
  router.get('/profile', [SessionController, 'profile']).as('api.profile')

  // ----------------------------------------------------------
  // OTP
  // ----------------------------------------------------------
  router.post('/otp/send', [OtpController, 'send']).as('otp.send')
  router.post('/otp/verify', [OtpController, 'verify']).as('otp.verify')
  router.get('/otp/status', [OtpController, 'status']).as('otp.status')
  router.post('/otp/resend', [OtpController, 'resend']).as('otp.resend')
  router.post('/password/reset', [OtpController, 'resetPassword']).as('password.reset')

  // ----------------------------------------------------------
  // KYC
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/', [KYCsController, 'index']).as('kyc.index')
    router.get('/stats', [KYCsController, 'stats']).as('kyc.stats')
    router.get('/:id', [KYCsController, 'show']).as('kyc.show')
    router.post('/', [KYCsController, 'store']).as('kyc.store')
    router.get('/verify/:numeroTelephone', [KYCsController, 'verifyAndStore']).as('kyc.verify')
    router.get('/search/phone', [KYCsController, 'searchByPhone']).as('kyc.search.phone')
    router.get('/search/name', [KYCsController, 'searchByName']).as('kyc.search.name')
    router.get('/filter/operator', [KYCsController, 'filterByOperator']).as('kyc.filter.operator')
    router.put('/:id', [KYCsController, 'update']).as('kyc.update')
    router.patch('/:id', [KYCsController, 'update']).as('kyc.patch')
    router.delete('/:id', [KYCsController, 'destroy']).as('kyc.destroy')
  }).prefix('/kyc')

  // ============================================================
  // BLOG
  // ============================================================
  router.get('/blog/posts', [BlogController, 'index']).as('blog.index')
  router.get('/blog/posts/featured', [BlogController, 'featured']).as('blog.featured')
  router.get('/blog/posts/:slug', [BlogController, 'show']).as('blog.show')
  router.post('/blog/posts/submit', [BlogController, 'publicStore']).as('blog.submit')
  router.get('/blog/posts/:postId/comments', [BlogController, 'getComments']).as('blog.comments.public')
  router.post('/blog/posts/:postId/comments', [BlogController, 'storeComment']).as('blog.comments.store')

  router.group(() => {
    router.get('/:userId/posts', [BlogController, 'merchantPosts']).as('blog.merchant.posts')
    router.get('/:userId/stats', [BlogController, 'merchantStats']).as('blog.merchant.stats')
    router.post('/:userId/posts', [BlogController, 'merchantStore']).as('blog.merchant.store')
    router.get('/:userId/posts/:id', [BlogController, 'merchantShow']).as('blog.merchant.show')
    router.put('/:userId/posts/:id', [BlogController, 'merchantUpdate']).as('blog.merchant.update')
    router.delete('/:userId/posts/:id', [BlogController, 'merchantDestroy']).as('blog.merchant.destroy')
    router.patch('/:userId/posts/:id/toggle-status', [BlogController, 'merchantToggleStatus']).as('blog.merchant.toggle-status')
    router.delete('/comments/:commentId', [BlogController, 'deleteComment']).as('blog.merchant.comments.delete')
  }).prefix('/blog/merchant')

  router.group(() => {
    router.get('/posts', [BlogController, 'adminIndex']).as('admin.posts.index')
    router.get('/posts/stats', [BlogController, 'stats']).as('admin.posts.stats')
    router.get('/posts/:id', [BlogController, 'adminShow']).as('admin.posts.show')
    router.post('/posts', [BlogController, 'store']).as('admin.posts.store')
    router.put('/posts/:id', [BlogController, 'update']).as('admin.posts.update')
    router.delete('/posts/:id', [BlogController, 'destroy']).as('admin.posts.destroy')
  }).prefix('/blog/admin')

  // ----------------------------------------------------------
  // TESTIMONIALS
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
  router.post('/contact', [ContactsController, 'store']).as('contact.store')
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
  // CLIENT (UTILISÉ PAR LE FRONTEND)
  // ----------------------------------------------------------
  router.get('/client/:id', [UsersController, 'show']).as('client.show')

  // ----------------------------------------------------------
  // SHOPS (UTILISÉ PAR LE FRONTEND)
  // ----------------------------------------------------------
  router.get('/shops/user/:userId', [ShopController, 'apiIndex']).as('shops.by-user')

  // ----------------------------------------------------------
  // PANIER
  // ----------------------------------------------------------
  router.get('/cart/:userId', [CartController, 'getCart']).as('cart.get')
  router.post('/cart/show', [CartController, 'show']).as('cart.show')
  router.post('/cart/add', [CartController, 'add']).as('cart.add')
  router.put('/cart/update-item', [CartController, 'updateItem']).as('cart.updateItem')
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
  // COMMANDES (ORDERS)
  // ----------------------------------------------------------
  router.post('/orders', [OrdersController, 'store']).as('orders.store')
  router.get('/orders/all', [OrdersController, 'allOrders']).as('orders.all')
  router.get('/orders/:userId', [OrdersController, 'index']).as('orders.user.index')
  router.get('/orders/:orderId/user/:userId', [OrdersController, 'show']).as('orders.show')
  router.post('/orders/:orderId/cancel', [OrdersController, 'cancel']).as('orders.cancel')
  router.get('/orders/:orderId/invoice/:userId', [OrdersController, 'invoice']).as('orders.invoice')
  router.post('/orders/generate-qr', [OrdersController as any, 'generateQRCode']).as('orders.qr.generate')
  router.post('/orders/confirm-qr-payment', [OrdersController as any, 'confirmQRPayment']).as('orders.qr.confirm')
  router.get('/orders/check-payment/:referenceId', [OrdersController, 'checkPaymentStatus']).as('orders.check-payment')
  router.get('/orders/:orderId/payment-status', [OrdersController, 'getPaymentStatus']).as('orders.payment-status')
  router.post('/orders/generate-link', [OrdersController as any, 'generatePaymentLink']).as('orders.link.generate')
  router.post('/orders/payment-callback', [OrdersController, 'paymentCallback']).as('orders.callback')
  router.get('/give-all-without-id/:referenceId', [OrdersController, 'giveAllWithoutId']).as('payment.without-id')
  router.get('/payment/status/:referenceId', [OrdersController, 'checkPaymentStatus']).as('payment.status')
  router.put('/orders/:orderId/status', [OrdersController, 'updateStatus']).as('orders.statuts.updates')
  router.put('/orders/:orderId/confirm-delivery', [OrdersController, 'confirmDelivery']).as('orders.confirm-delivery')

  // ----------------------------------------------------------
  // SUIVI DE COMMANDE
  // ----------------------------------------------------------
  router.post('/tracking/search', [OrderTrackingController, 'search']).as('tracking.search')
  router.get('/tracking/:orderId/events', [OrderTrackingController, 'getTrackingEvents']).as('tracking.events')
  router.post('/tracking/:orderId/event', [OrderTrackingController, 'addTrackingEvent']).as('tracking.event.add')
  router.put('/tracking/:orderId/status', [OrderTrackingController, 'updateOrderStatus']).as('tracking.status.update')

  // ----------------------------------------------------------
  // COUPONS
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
  // GIVE-CHANGE (RETRAITS) + ZONES DE LIVRAISON
  // ----------------------------------------------------------
  router.post('/merchant/give-change', [GiveChangeController, 'giveChange']).as('merchant.give-change')
  router.group(() => {
    router.get('give-change/:reference/status', [GiveChangeController, 'checkStatus']).as('merchant.give-change.status')
    router.get('give-change/history', [GiveChangeController, 'history']).as('merchant.give-change.history')
    router.get('give-change/stats', [GiveChangeController, 'stats']).as('merchant.give-change.stats')
    
    // Zones de livraison
    router.get('/:userId/delivery-zones', [MerchantDashboardController, 'getDeliveryZones'])
    router.post('/:userId/delivery-zones', [MerchantDashboardController, 'upsertDeliveryZone'])
    router.put('/:userId/delivery-zones', [MerchantDashboardController, 'updateDeliveryZones'])
    router.delete('/:userId/delivery-zones', [MerchantDashboardController, 'removeDeliveryZone'])
    router.get('/:userId/delivery-fee', [MerchantDashboardController, 'calculateDeliveryFee'])
    
    router.post('give-change/:id/cancel', [GiveChangeController, 'cancel']).as('merchant.give-change.cancel')
  }).prefix('/merchant')
  router.get('/merchant/dashboard/withdrawal-stats', [MerchantDashboardController, 'getWithdrawalStats']).as('merchant.dashboard.withdrawal-stats')

  // ----------------------------------------------------------
  // MARCHAND (MERCHANT)
  // ----------------------------------------------------------
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

  router.group(() => {
    router.get('/archived', [MerchantDashboardController, 'getArchivedProducts']).as('merchant.archived-products.index')
    router.post('/archived/:productId/restore', [MerchantDashboardController, 'restoreArchivedProduct']).as('merchant.archived-products.restore')
    router.delete('/archived/:productId/permanent', [MerchantDashboardController, 'permanentlyDeleteProduct']).as('merchant.archived-products.permanent-delete')
  }).prefix('/merchant/products/:userId')

  router.group(() => {
    router.get('/archived-products', [MerchantDashboardController, 'getArchivedProducts']).as('merchant.archived-products.restful.index')
    router.post('/archived-products/:productId/restore', [MerchantDashboardController, 'restoreArchivedProduct']).as('merchant.archived-products.restful.restore')
    router.delete('/archived-products/:productId/permanent', [MerchantDashboardController, 'permanentlyDeleteProduct']).as('merchant.archived-products.restful.permanent-delete')
  }).prefix('/merchant/:userId')

  router.get('/merchant/categories/:userId', [MerchantDashboardController, 'getCategories']).as('merchant.categories.index')
  router.post('/merchant/categories/:userId', [MerchantDashboardController, 'createCategory']).as('merchant.categories.store')
  router.put('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'updateCategory']).as('merchant.categories.update')
  router.delete('/merchant/categories/:userId/:categoryId', [MerchantDashboardController, 'deleteCategory']).as('merchant.categories.destroy')
  router.get('/merchant/coupons/:userId', [MerchantDashboardController, 'getCoupons']).as('merchant.coupons.index')
  router.post('/merchant/coupons/:userId', [MerchantDashboardController, 'createCoupon']).as('merchant.coupons.store')
  router.put('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'updateCoupon']).as('merchant.coupons.update')
  router.delete('/merchant/coupons/:userId/:couponId', [MerchantDashboardController, 'deleteCoupon']).as('merchant.coupons.destroy')

  // ----------------------------------------------------------
  // MARCHANDS (LISTE PUBLIQUE)
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/:id/products', [MerchantsController, 'merchantProducts']).as('merchants.products')
    router.get('/', [MerchantsController, 'index']).as('merchants.index')
    router.get('/all', [MerchantsController, 'all']).as('merchants.all')
    router.get('/active', [MerchantsController, 'index']).as('merchants.active')
    router.get('/search', [MerchantsController, 'index']).as('merchants.search')
    router.get('/:id', [MerchantsController, 'show']).as('merchants.show')
    router.get('/:id/stats', [MerchantsController, 'show']).as('merchants.stats')
  }).prefix('/merchants')

  // ----------------------------------------------------------
  // AVIS (REVIEWS)
  // ----------------------------------------------------------
  router.get('/reviews/product/:productId', [ReviewsController, 'getProductReviews']).as('reviews.product')
  router.get('/reviews/merchant/:merchantId', [ReviewsController, 'getMerchantReviews']).as('reviews.merchant')
  router.get('/reviews/user/:userId', [ReviewsController, 'myReviews']).as('reviews.user')
  router.post('/reviews/:id/helpful', [ReviewsController, 'markHelpful']).as('reviews.helpful')
  router.post('/reviews', [ReviewsController, 'store']).as('reviews.store')
  router.put('/reviews/:id', [ReviewsController, 'update']).as('reviews.update')
  router.delete('/reviews/:id', [ReviewsController, 'destroy']).as('reviews.destroy')
  router.get('/reviews', [ReviewsController, 'index']).as('reviews.index')
  router.get('/reviews/:id', [ReviewsController, 'show']).as('reviews.show')
  router.patch('/reviews/:id/approve', [ReviewsController, 'approve']).as('reviews.approve')
  router.patch('/reviews/:id/reject', [ReviewsController, 'reject']).as('reviews.reject')

  // ----------------------------------------------------------
  // HÔTELS (HOTELS)
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/search/location', [HotelsController, 'searchByLocation']).as('hotels.search.location')
    router.get('/city/:city', [HotelsController, 'getByCity']).as('hotels.city')
    router.get('/', [HotelsController, 'index']).as('hotels.index')
    router.post('/', [HotelsController, 'store']).as('hotels.store')
    router.get('/:id', [HotelsController, 'show']).as('hotels.show')
    router.put('/:id', [HotelsController, 'update']).as('hotels.update')
    router.delete('/:id', [HotelsController, 'destroy']).as('hotels.destroy')
    router.get('/:id/rooms', [HotelsController, 'getRooms']).as('hotels.rooms')
  }).prefix('/hotels')

  // ----------------------------------------------------------
  // CHAMBRES (ROOMS)
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/', [RoomsController, 'index']).as('rooms.index')
    router.post('/', [RoomsController, 'store']).as('rooms.store')
    router.get('/:id', [RoomsController, 'show']).as('rooms.show')
    router.put('/:id', [RoomsController, 'update']).as('rooms.update')
    router.delete('/:id', [RoomsController, 'destroy']).as('rooms.destroy')
  }).prefix('/rooms')

  // ----------------------------------------------------------
  // SHOP
  // ----------------------------------------------------------
  router.get('/shop', [ShopController, 'apiIndex']).as('api.shop.index')
  router.get('/shop/coupons', [ShopController, 'apiCoupons']).as('api.shop.coupons')
  router.get('/shop/promotions', [ShopController, 'apiPromotions']).as('api.shop.promotions')
  router.get('/shops/user/:userId', [ShopController, 'getByUser']).as('shops.by-user')

  // ----------------------------------------------------------
  // MYPVIT
  // ----------------------------------------------------------
  router.post('/mypvit/renew-secret', [MypvitController, 'renewSecret']).as('mypvit.renew-secret')
  router.get('/mypvit/secret', [MypvitController, 'getCurrentSecret']).as('mypvit.secret')
  router.get('/mypvit/countries', [MypvitController, 'getCountries']).as('mypvit.countries')
  router.get('/mypvit/operators', [MypvitController, 'getOperators']).as('mypvit.operators')
  router.get('/mypvit/countries-with-operators', [MypvitController, 'getCountriesWithOperators']).as('mypvit.countries-operators')
  router.get('/mypvit/check-operator', [MypvitController, 'checkOperator']).as('mypvit.check-operator')
  router.post('/mypvit/clear-cache', [MypvitController, 'clearCache']).as('mypvit.clear-cache')
  router.get('/mypvit/kyc', [MypvitController, 'getKYC']).as('mypvit.kyc')
  router.get('/mypvit/kyc/active', [MypvitController, 'checkActive']).as('mypvit.kyc.active')
  router.post('/mypvit/kyc/verify', [MypvitController, 'verifyIdentity']).as('mypvit.kyc.verify')
  router.post('/mypvit/qrcode/generate', [MypvitController, 'generateQRCode']).as('mypvit.qrcode.generate')
  router.post('/mypvit/qrcode/static', [MypvitController, 'generateStaticQRCode']).as('mypvit.qrcode.static')
  router.post('/mypvit/qrcode/dynamic', [MypvitController, 'generateDynamicQRCode']).as('mypvit.qrcode.dynamic')
  router.post('/mypvit/qrcode/image', [MypvitController, 'generateQRCodeImage']).as('mypvit.qrcode.image')
  router.post('/mypvit/transaction/payment', [MypvitController, 'processPayment']).as('mypvit.transaction.payment')
  router.post('/mypvit/transaction/give-change', [MypvitController, 'processGiveChange']).as('mypvit.transaction.give-change')
  router.get('/mypvit/transaction/status', [MypvitController, 'checkTransactionStatus']).as('mypvit.transaction.status')
  router.post('/mypvit/link/web', [MypvitController, 'generateWebLink']).as('mypvit.link.web')
  router.post('/mypvit/link/visa', [MypvitController, 'generateVisaLink']).as('mypvit.link.visa')
  router.post('/mypvit/link/rest', [MypvitController, 'generateRestLink']).as('mypvit.link.rest')
  router.get('/mypvit/balance', [MypvitController, 'getBalance']).as('mypvit.balance')
  router.post('/mypvit/check-balance', [MypvitController, 'checkBalance']).as('mypvit.check-balance')
  router.get('/mypvit/all-balances', [MypvitController, 'getAllBalances']).as('mypvit.all-balances')
  router.post('/mypvit/callback', [CallbackController, 'handle']).as('mypvit.callback.orders')
  router.post('/mypvit/callback/rendu-money', (ctx) => RenduMoneyCallback.handle(ctx)).as('mypvit.callback.rendu-money')
  router.post('/mypvit/callback/subscription', (ctx) => SubscriptionCallback.handle(ctx)).as('mypvit.callback.subscription')
  router.post('/mypvit/callback/subscription/test', (ctx) => SubscriptionCallback.test(ctx)).as('mypvit.callback.subscription.test')

  // ----------------------------------------------------------
  // PAIEMENT MYPVIT
  // ----------------------------------------------------------
  router.post('/orders/pay/mobile-money', [PayMobileMoneyController, 'pay']).as('orders.pay.mobile-money')
  router.post('/orders/pay/qr-code', [PayQRCodeController, 'pay']).as('orders.pay.qr-code')
  router.post('/orders/pay/link', [PayLinkController, 'pay']).as('orders.pay.link')

  // ============================================================
  // ABONNEMENTS (SUBSCRIPTIONS)
  // ============================================================
  router.get('/subscriptions/plans', (ctx) => Subscription.getPlans(ctx)).as('subscriptions.plans')
  router.get('/subscriptions/active/:userId', (ctx) => Subscription.getActiveSubscription(ctx)).as('subscriptions.active')
  router.get('/subscriptions/history/:userId', (ctx) => Subscription.getHistory(ctx)).as('subscriptions.history')
  router.get('/subscriptions/stats/:userId', (ctx) => Subscription.getStats(ctx)).as('subscriptions.stats')
  router.post('/subscriptions/subscribe', (ctx) => Subscription.subscribe(ctx)).as('subscriptions.subscribe')
  router.post('/subscriptions/pay/qr', (ctx) => SubscriptionQR.pay(ctx)).as('subscriptions.pay.qr')
  router.post('/subscriptions/pay/link', [PayLinkSubscriptionController, 'paySubscription']).as('subscriptions.pay.link')
  router.get('/subscriptions/:id/payment-status', (ctx) => Subscription.checkPaymentStatus(ctx)).as('subscriptions.payment-status')
  router.post('/subscriptions/:id/add-product', (ctx) => Subscription.addProductToBoost(ctx)).as('subscriptions.add-product')
  router.post('/subscriptions/:id/remove-product', (ctx) => Subscription.removeProductFromBoost(ctx)).as('subscriptions.remove-product')
  router.post('/subscriptions/:id/cancel', (ctx) => Subscription.cancel(ctx)).as('subscriptions.cancel')
  router.post('/subscriptions/:id/auto-renew', (ctx) => Subscription.toggleAutoRenew(ctx)).as('subscriptions.auto-renew')

  // ----------------------------------------------------------
  // ADMIN
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/merchants', [MerchantsController, 'index']).as('admin.merchants.index')
    router.get('/merchants/stats', [MerchantsController, 'all']).as('admin.merchants.stats')
    router.patch('/merchants/:id/toggle-status', [MerchantsController, 'verifyMerchant']).as('admin.merchants.toggle')
    router.patch('/merchants/:id/verify', [MerchantsController, 'verifyMerchant']).as('admin.merchants.verify')
    router.post('/merchants/:id/reject', [MerchantsController, 'rejectMerchant']).as('admin.merchants.reject')
    router.get('/merchants/:id/details', [MerchantsController, 'adminShow']).as('admin.merchants.show')
    router.delete('/merchants/:id', [MerchantsController, 'all']).as('admin.merchants.destroy')
  }).prefix('/admin')

  // ----------------------------------------------------------
  // REFUNDS
  // ----------------------------------------------------------
  router.group(() => {
    router.get('/', [RefundsController, 'index']).as('refunds.index')
    router.get('/:id', [RefundsController, 'show']).as('refunds.show')
    router.post('/', [RefundsController, 'store']).as('refunds.store')
    router.get('/user/:userId', [RefundsController, 'userRefunds']).as('refunds.user')
    router.get('/order/:orderId', [RefundsController, 'orderRefunds']).as('refunds.order')
    router.patch('/:id/approve', [RefundsController, 'approve']).as('refunds.approve')
    router.patch('/:id/reject', [RefundsController, 'reject']).as('refunds.reject')
    router.patch('/:id/complete', [RefundsController, 'complete']).as('refunds.complete')
    router.get('/stats/global', [RefundsController, 'stats']).as('refunds.stats')
  }).prefix('/refunds')

  // ----------------------------------------------------------
  // PAYPAL
  // ----------------------------------------------------------
  router.post('/paypal/create', [PayPalController, 'createPayment']).as('paypal.create')
  router.get('/paypal/success/:token', [PayPalController, 'success']).as('paypal.success')
  router.get('/paypal/cancel', [PayPalController, 'cancel']).as('paypal.cancel')

  // ----------------------------------------------------------
  // VÉRIFICATION STATUT PAIEMENT (PROXY PVIT)
  // ----------------------------------------------------------
  router.get('/payments/status/verify', [CheckStatusController, 'verify']).as('payments.status.verify')

  // ----------------------------------------------------------
  // VÉRIFICATION STATUT PAIEMENT (EXISTANT)
  // ----------------------------------------------------------
  router.get('/orders/:orderNumber/payment-status', [CheckPaymentStatusController, 'check']).as('check_payment_status.check_by_order')
  router.post('/orders/check-payment-status', [CheckPaymentStatusController, 'check']).as('check_payment_status.check_by_reference')

  // ----------------------------------------------------------
  // PRODUITS SPÉCIAUX
  // ----------------------------------------------------------
  router.get('/products/on-sale', [ProductController, 'onSale']).as('products.on-sale')
  router.get('/products/biggest-discounts', [ProductController, 'biggestDiscounts']).as('products.biggest-discounts')
  router.get('/products/black-friday', [ProductController, 'blackFriday']).as('products.black-friday')

  // ----------------------------------------------------------
  // CALLBACK MYPVIT
  // ----------------------------------------------------------
  router.post('/callbacks/mypvit', [CallbacksController, 'handle']).as('callbacks.mypvit')

  // ----------------------------------------------------------
  // PAIEMENT MOBILE MONEY
  // ----------------------------------------------------------
  router.post('/mobile-moneys/pay', [PayMobileMoneyController, 'pay']).as('mobile-money.pay')

  // ----------------------------------------------------------
  // RETRAIT
  // ----------------------------------------------------------
  router.post('/retrait', [RetraitController, 'retrait']).as('retrait.process')

  // ----------------------------------------------------------
  // PROMOTIONS
  // ----------------------------------------------------------
  router.get('/promotions', [PromotionsController, 'index']).as('promotions.index')
  router.get('/promotions/:id', [PromotionsController, 'show']).as('promotions.show')
  router.get('/promotions/banners', [PromotionsController, 'banners']).as('promotions.banners')
  router.get('/promotions/flash-sales', [PromotionsController, 'flashSales']).as('promotions.flash-sales')
  router.post('/promotions', [PromotionsController, 'store']).as('promotions.store')
  router.put('/promotions/:id', [PromotionsController, 'update']).as('promotions.update')
  router.delete('/promotions/:id', [PromotionsController, 'destroy']).as('promotions.destroy')

  // ============================================================
  // CONTRATS MARCHANDS (COMPLET)
  // ============================================================
  
  // Routes pour le Dashboard (admin)
  router.get('/merchant/contract/:id/sign', [DashboardViewController, 'signContract']).as('merchant.contract.sign')
  router.post('/merchant/contract/:id/send', [DashboardViewController, 'sendContractEmail']).as('merchant.contract.send')
  router.get('/merchant/contract/:id/status', [DashboardViewController, 'getContractStatus']).as('merchant.contract.status')

  // Routes pour l'API Frontend (VendorContractPage)
  router.post('/contracts/sign-and-send', [ContractsController, 'signAndSend']).as('contracts.sign-and-send')
  router.post('/contracts/sign', [ContractsController, 'sign']).as('contracts.sign')
  router.post('/contracts/sign/:id', [ContractsController, 'sign']).as('contracts.sign.by-id')
  router.post('/contracts/send-email', [ContractsController, 'sendEmail']).as('contracts.send-email')
  router.get('/contract/by-name/:name', [ContractsController, 'getByName']).as('contracts.by-name')

  // ----------------------------------------------------------
  // CHECKOUT
  // ----------------------------------------------------------
  router.get('/checkout/:userId', [CheckoutController, 'getCheckoutData']).as('checkout.data')

  // ----------------------------------------------------------
  // LIVRAISON (DELIVERY)
  // ----------------------------------------------------------
  router.get('/merchant/:merchantId/delivery-zones', [MerchantDeliveryController, 'getDeliveryZones'])
  router.get('/merchant/:merchantId/delivery-fee', [MerchantDeliveryController, 'getDeliveryFee'])
  router.post('/cart/delivery-fees', [MerchantDeliveryController, 'calculateCartDeliveryFees'])

}).prefix('/api')
