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
}
