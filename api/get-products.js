// api/get-products.js
// Récupère les produits de votre boutique Printful

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Récupérer la liste des produits du store
    const storeRes = await fetch('https://api.printful.com/store/products?limit=20', {
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    const storeData = await storeRes.json();

    if (!storeData.result) {
      return res.status(500).json({ error: 'Printful API error', detail: storeData });
    }

    // 2. Pour chaque produit, récupérer le détail (variantes + prix)
    const products = await Promise.all(
      storeData.result.map(async (item) => {
        const detailRes = await fetch(`https://api.printful.com/store/products/${item.id}`, {
          headers: {
            'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
            'Content-Type': 'application/json',
          }
        });
        const detail = await detailRes.json();
        const { sync_product, sync_variants } = detail.result;

        return {
          id: sync_product.id,
          name: sync_product.name,
          image: sync_product.thumbnail_url,
          variants: sync_variants.map(v => ({
            id: v.id,
            name: v.name,
            price: v.retail_price,
            size: v.size || extractSize(v.name),
            color: v.color || null,
            available: v.availability_status === 'active',
          })).filter(v => v.available),
        };
      })
    );

    return res.status(200).json({ products });

  } catch (err) {
    console.error('get-products error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Extrait la taille depuis le nom de variante si non fourni (ex: "Mon T-shirt / S")
function extractSize(name) {
  const match = name.match(/\b(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL)\b/i);
  return match ? match[1].toUpperCase() : null;
}
