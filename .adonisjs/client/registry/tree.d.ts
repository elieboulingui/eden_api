/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  orders: {
    checkPaymentStatus: typeof routes['orders.check_payment_status']
    show: typeof routes['orders.show']
    paymentStatusCallbacks: typeof routes['orders.payment_status_callbacks']
  }
  pubs: {
    getAllPubs: typeof routes['pubs.get_all_pubs']
    createPub: typeof routes['pubs.create_pub']
    updatePub: typeof routes['pubs.update_pub']
    deletePub: typeof routes['pubs.delete_pub']
    togglePubStatus: typeof routes['pubs.toggle_pub_status']
  }
}
