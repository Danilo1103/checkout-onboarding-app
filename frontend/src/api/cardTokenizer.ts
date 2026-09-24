import { env } from '../env';
import { detectBrand, digitsOnly, parseExpiry, type CardInput } from '../lib/card';
import { ApiError, requestJson } from './http';
import type { CardSummary } from './types';

interface TokenResponse {
  data: { id: string; last_four: string };
}

/**
 * Sends the card straight to the payment gateway with the PUBLIC key.
 * Card number and CVC never reach our backend: only the returned token does.
 */
export const tokenizeCard = async (card: CardInput): Promise<CardSummary> => {
  const expiry = parseExpiry(card.expiry);
  if (!expiry) throw new ApiError('Fecha de vencimiento inválida', 400);
  try {
    const { data } = await requestJson<TokenResponse>(`${env.paymentApiUrl}/tokens/cards`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.paymentPublicKey}` },
      body: JSON.stringify({
        number: digitsOnly(card.number),
        cvc: card.cvc,
        exp_month: expiry.month,
        exp_year: expiry.year,
        card_holder: card.holder.trim(),
      }),
    });
    return { token: data.id, brand: detectBrand(card.number), last4: data.last_four };
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) throw error;
    throw new ApiError('No pudimos validar tu tarjeta. Revisa los datos.', 422);
  }
};

export type TokenizeCard = typeof tokenizeCard;
