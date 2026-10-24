export { adminEmailsRouter } from "./notifications.routes"
export { EmailService, inBackground } from "./notifications.service"
export {
  emitCustomerRegistered,
  emitOrderPlaced,
  emitOrderStatusChanged,
  registerEmailListeners,
} from "./notifications.events"
export { emailBacklog, initEmailQueue, startEmailWorker, stopEmailQueue } from "./email.queue"
