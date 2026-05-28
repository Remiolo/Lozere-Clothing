// api/get-products.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const storeRes = await fetch('https://api.printful.com/store/products?limit=20', {
      headers: { 'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}` }
    });
    const storeData = await storeRes.json();
    if (!storeData.result) return res.status(500).json({ error: 'Printful API error', detail: storeData });

    const products = await Promise.all(
      storeData.result.map(async (item) => {
        const detailRes = await fetch(`https://api.printful.com/store/products/${item.id}`, {
          headers: { 'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}` }
        });
        const detail = await detailRes.json();
        const { sync_product, sync_variants } = detail.result;

        // Construire un mapping couleur → image
        // Printful fournit les fichiers de preview par variante
        const colorImages = {};
        for (const v of sync_variants) {
          const color = v.color || null;
          if (color && !colorImages[color] && v.files) {
            // Chercher le fichier "preview" ou "front" dans les fichiers de la variante
            const preview = v.files.find(f => f.type === 'preview') || v.files.find(f => f.type === 'front') || v.files[0];
            if (preview?.preview_url) colorImages[color] = preview.preview_url;
          }
        }

        return {
          id: sync_product.id,
          name: sync_product.name,
          image: sync_product.thumbnail_url, // image par défaut
          colorImages,                        // { "Sky Blue": "https://...", "Lavender": "https://..." }
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

function extractSize(name) {
  const match = name.match(/\b(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL)\b/i);
  return match ? match[1].toUpperCase() : null;
}
