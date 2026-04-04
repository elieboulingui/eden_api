/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  orders: {
    checkPaymentStatus: typeof routes['orders.check_payment_status']
    paymentStatusCallbacks: typeof routes['orders.payment_status_callbacks']
    store: typeof routes['orders.store']
    index: typeof routes['orders.index']
    show: typeof routes['orders.show']
    cancel: typeof routes['orders.cancel']
    invoice: typeof routes['orders.invoice']
    updateStatus: typeof routes['orders.update_status']
  }
  pubs: {
    getAllPubs: typeof routes['pubs.get_all_pubs']
    createPub: typeof routes['pubs.create_pub']
    updatePub: typeof routes['pubs.update_pub']
    deletePub: typeof routes['pubs.delete_pub']
    togglePubStatus: typeof routes['pubs.toggle_pub_status']
  }
  merchantDashboard: {
    giveChange: typeof routes['merchant_dashboard.give_change']
    getWithdrawalHistory: typeof routes['merchant_dashboard.get_withdrawal_history']
    getWallet: typeof routes['merchant_dashboard.get_wallet']
    dashboard: typeof routes['merchant_dashboard.dashboard']
    getStats: typeof routes['merchant_dashboard.get_stats']
    getMerchantOrders: typeof routes['merchant_dashboard.get_merchant_orders']
    getPendingOrders: typeof routes['merchant_dashboard.get_pending_orders']
    getOrderDetails: typeof routes['merchant_dashboard.get_order_details']
    getRecentOrders: typeof routes['merchant_dashboard.get_recent_orders']
    getProducts: typeof routes['merchant_dashboard.get_products']
    createProduct: typeof routes['merchant_dashboard.create_product']
    updateProduct: typeof routes['merchant_dashboard.update_product']
    deleteProduct: typeof routes['merchant_dashboard.delete_product']
    getCategories: typeof routes['merchant_dashboard.get_categories']
    createCategory: typeof routes['merchant_dashboard.create_category']
    updateCategory: typeof routes['merchant_dashboard.update_category']
    deleteCategory: typeof routes['merchant_dashboard.delete_category']
    getCoupons: typeof routes['merchant_dashboard.get_coupons']
    createCoupon: typeof routes['merchant_dashboard.create_coupon']
    updateCoupon: typeof routes['merchant_dashboard.update_coupon']
    deleteCoupon: typeof routes['merchant_dashboard.delete_coupon']
  }
  coupons: {
    index: typeof routes['coupons.index']
    apply: typeof routes['coupons.apply']
    verify: typeof routes['coupons.verify']
    show: typeof routes['coupons.show']
  }
  newAccount: {
    store: typeof routes['new_account.store']
  }
  session: {
    store: typeof routes['session.store']
    update: typeof routes['session.update']
    destroy: typeof routes['session.destroy']
  }
  users: {
    index: typeof routes['users.index']
    show: typeof routes['users.show']
  }
  products: {
    index: typeof routes['products.index']
    show: typeof routes['products.show']
    store: typeof routes['products.store']
    update: typeof routes['products.update']
    destroy: typeof routes['products.destroy']
  }
  categories: {
    index: typeof routes['categories.index']
    show: typeof routes['categories.show']
    store: typeof routes['categories.store']
    update: typeof routes['categories.update']
    destroy: typeof routes['categories.destroy']
    createProduct: typeof routes['categories.create_product']
  }
  cart: {
    getCart: typeof routes['cart.get_cart']
    show: typeof routes['cart.show']
    add: typeof routes['cart.add']
    update: typeof routes['cart.update']
    deleteItem: typeof routes['cart.delete_item']
    clear: typeof routes['cart.clear']
  }
  favorites: {
    add: typeof routes['favorites.add']
    remove: typeof routes['favorites.remove']
    index: typeof routes['favorites.index']
    check: typeof routes['favorites.check']
  }
  orderTracking: {
    search: typeof routes['order_tracking.search']
    getTrackingEvents: typeof routes['order_tracking.get_tracking_events']
    addTrackingEvent: typeof routes['order_tracking.add_tracking_event']
    updateOrderStatus: typeof routes['order_tracking.update_order_status']
  }
}
