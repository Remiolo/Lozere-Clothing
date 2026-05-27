// api/create-payment.js
// Crée un PaymentIntent Stripe pour le montant du panier

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, items } = req.body;

    if (!amount || !items || items.length === 0) {
      return res.status(400).json({ error: 'Montant ou articles manquants' });
    }

    // Sécurité : recalcul du total côté serveur pour éviter toute manipulation
    const computed = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.qty), 0);
    const amountCents = Math.round(computed * 100); // Stripe utilise les centimes

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        items: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, qty: i.qty }))),
        source: 'lozere48-merch',
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: err.message });
  }
}
