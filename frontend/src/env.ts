/** Build-time configuration. Isolated here so tests can replace it. */
export const env = {
  apiUrl: import.meta.env.VITE_API_URL as string,
  paymentApiUrl: import.meta.env.VITE_PAYMENT_API_URL as string,
  paymentPublicKey: import.meta.env.VITE_PAYMENT_PUBLIC_KEY as string,
};
