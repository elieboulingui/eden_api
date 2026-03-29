/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  api: {
    client: {
      register: typeof routes['api.client.register']
      login: typeof routes['api.client.login']
      profile: {
        update: typeof routes['api.client.profile.update']
      }
      logout: typeof routes['api.client.logout']
    }
    tracking: {
      search: typeof routes['api.tracking.search']
      events: typeof routes['api.tracking.events']
      addEvent: typeof routes['api.tracking.add-event']
      updateStatus: typeof routes['api.tracking.update-status']
    }
    users: {
      index: typeof routes['api.users.index']
      show: typeof routes['api.users.show']
    }
    products: {
      index: typeof routes['api.products.index']
      show: typeof routes['api.products.show']
      store: typeof routes['api.products.store']
      update: typeof routes['api.products.update']
      destroy: typeof routes['api.products.destroy']
    }
    categories: {
      index: typeof routes['api.categories.index']
      show: typeof routes['api.categories.show']
      store: typeof routes['api.categories.store']
      update: typeof routes['api.categories.update']
      destroy: typeof routes['api.categories.destroy']
      products: {
        store: typeof routes['api.categories.products.store']
      }
    }
    cart: {
      get: typeof routes['api.cart.get']
      show: typeof routes['api.cart.show']
      add: typeof routes['api.cart.add']
      update: typeof routes['api.cart.update']
      delete: typeof routes['api.cart.delete']
    }
    favorites: {
      add: typeof routes['api.favorites.add']
      remove: typeof routes['api.favorites.remove']
      index: typeof routes['api.favorites.index']
      check: typeof routes['api.favorites.check']
    }
    orders: {
      store: typeof routes['api.orders.store']
      index: typeof routes['api.orders.index']
      show: typeof routes['api.orders.show']
      cancel: typeof routes['api.orders.cancel']
      invoice: typeof routes['api.orders.invoice']
      updateStatus: typeof routes['api.orders.update-status']
    }
    merchant: {
      dashboard: typeof routes['api.merchant.dashboard']
      stats: typeof routes['api.merchant.stats']
      orders: typeof routes['api.merchant.orders']
      products: typeof routes['api.merchant.products'] & {
        create: typeof routes['api.merchant.products.create']
        update: typeof routes['api.merchant.products.update']
        delete: typeof routes['api.merchant.products.delete']
      }
      categories: typeof routes['api.merchant.categories'] & {
        create: typeof routes['api.merchant.categories.create']
        update: typeof routes['api.merchant.categories.update']
        delete: typeof routes['api.merchant.categories.delete']
      }
      coupons: typeof routes['api.merchant.coupons'] & {
        create: typeof routes['api.merchant.coupons.create']
        update: typeof routes['api.merchant.coupons.update']
        delete: typeof routes['api.merchant.coupons.delete']
      }
    }
    coupons: {
      index: typeof routes['api.coupons.index']
      verify: typeof routes['api.coupons.verify']
      show: typeof routes['api.coupons.show']
    }
  }
  merchantDashboard: {
    index: typeof routes['merchant_dashboard.index']
  }
}
