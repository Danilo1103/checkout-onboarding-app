export const USE_CASES = {
  listProducts: Symbol('ListProducts'),
  getProduct: Symbol('GetProduct'),
  getQuote: Symbol('GetCheckoutQuote'),
  getAcceptance: Symbol('GetAcceptanceTokens'),
  upsertCustomer: Symbol('UpsertCustomer'),
  createTransaction: Symbol('CreateTransaction'),
  syncTransaction: Symbol('SyncTransaction'),
  getDelivery: Symbol('GetDelivery'),
} as const;
