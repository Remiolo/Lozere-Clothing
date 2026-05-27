// api/create-order.js
// Crée la commande chez Printful après paiement Stripe confirmé

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, address, items } = req.body;

    if (!name || !email || !address || !items?.length) {
      return res.status(400).json({ error: 'Données de commande incomplètes' });
    }

    const [firstName, ...lastParts] = name.trim().split(' ');
    const lastName = lastParts.join(' ') || firstName;

    const order = {
      recipient: {
        name,
        email,
        address1: address.line1,
        city: address.city,
        country_code: address.country || 'FR',
        zip: address.zip,
      },
      items: items.map(item => ({
        sync_variant_id: item.variantId || item.id,
        quantity: item.qty,
        retail_price: item.price.toString(),
        name: item.name,
      })),
      retail_costs: {
        currency: 'EUR',
        subtotal: items.reduce((s, i) => s + parseFloat(i.price) * i.qty, 0).toFixed(2),
      },
    };

    const printfulRes = await fetch('https://api.printful.com/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });

    const printfulData = await printfulRes.json();

    if (printfulData.code !== 200) {
      console.error('Printful order error:', printfulData);
      // On ne bloque pas le client — la commande Stripe est déjà confirmée
      // Loguer pour traitement manuel si besoin
      return res.status(200).json({ 
        success: true, 
        warning: 'Stripe OK mais erreur Printful — contactez le support',
        detail: printfulData.result 
      });
    }

    // Confirmer la commande pour lancer la production
    const confirmRes = await fetch(
      `https://api.printful.com/orders/${printfulData.result.id}/confirm`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const confirmData = await confirmRes.json();
    return res.status(200).json({ success: true, orderId: confirmData.result?.id });

  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: err.message });
  }
}
