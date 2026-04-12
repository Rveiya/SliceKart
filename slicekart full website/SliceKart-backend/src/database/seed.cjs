const { Pool } = require("pg");

require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
});

const products = [
    {
        name: 'Beetroot Juice',
        description: 'Fresh Beetroot Juice is rich in nitrates and antioxidants to power your body, improve circulation, and support everyday wellness. Great for athletes and active individuals.',
        price: 79,
        original_price: 99,
        discount: 20,
        category: 'energy',
        image_url: 'https://images.unsplash.com/photo-1638176066666-ffb2f013c7dd?w=500&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1638176066666-ffb2f013c7dd?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1617625802912-cde586faf331?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1571506165871-ee72a35bc9d4?w=500&h=400&fit=crop'
        ],
        volume: '100ml',
        stock: 80,
        rating: 4.3,
        nutrition: { protein: '1g', carbs: '10g', sugar: '7g', fiber: '1.5g' },
        benefits: ['Increases Energy & Stamina', 'Supports Heart Health', 'Improves Blood Health', 'Enhances Workout Performance']
    },
    {
        name: 'Jeera Water',
        description: 'Jeera Water infused with natural compounds to improve digestion, reduce bloating, and support everyday metabolism. A traditional remedy for digestive wellness.',
        price: 49,
        original_price: 69,
        discount: 29,
        category: 'detox',
        image_url: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=500&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1571506165871-ee72a35bc9d4?w=500&h=400&fit=crop'
        ],
        volume: '200ml',
        stock: 120,
        rating: 4.2,
        nutrition: { protein: '0g', carbs: '5g', sugar: '2g', fiber: '0.5g' },
        benefits: ['Improves Digestion', 'Reduces Bloating', 'Boosts Metabolism', 'Supports Detoxification']
    },
    {
        name: 'Aloe Vera Juice',
        description: 'Fresh Aloe Vera juice known for its soothing properties. Helps with digestion, skin health, and provides essential vitamins and minerals.',
        price: 99,
        original_price: 129,
        discount: 23,
        category: 'wellness',
        image_url: 'https://images.unsplash.com/photo-1596360934536-a5168c6c1e25?w=500&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1596360934536-a5168c6c1e25?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1611241893603-3c359704e0ee?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&h=400&fit=crop'
        ],
        volume: '150ml',
        stock: 60,
        rating: 4.4,
        nutrition: { protein: '0.2g', carbs: '6g', sugar: '3g', fiber: '1g' },
        benefits: ['Soothes Digestive System', 'Promotes Skin Health', 'Rich in Antioxidants', 'Hydrating Properties']
    },
    {
        name: 'Wheatgrass Shot',
        description: 'Concentrated wheatgrass juice shot for maximum health benefits. Packed with chlorophyll and essential nutrients for detoxification and energy.',
        price: 59,
        original_price: 79,
        discount: 25,
        category: 'detox',
        image_url: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=500&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1571506165871-ee72a35bc9d4?w=500&h=400&fit=crop'
        ],
        volume: '30ml',
        stock: 150,
        rating: 4.6,
        nutrition: { protein: '1g', carbs: '3g', sugar: '1g', fiber: '0.5g' },
        benefits: ['Powerful Detoxification', 'Boosts Energy', 'Rich in Chlorophyll', 'Supports Immune System']
    },
    {
        name: 'Mixed Fruit Juice',
        description: 'A delicious blend of fresh seasonal fruits including apple, orange, and pomegranate. Rich in vitamins and natural sugars for an instant energy boost.',
        price: 119,
        original_price: 149,
        discount: 20,
        category: 'energy',
        image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&h=400&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=500&h=400&fit=crop',
            'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&h=400&fit=crop'
        ],
        volume: '200ml',
        stock: 70,
        rating: 4.7,
        nutrition: { protein: '0.5g', carbs: '25g', sugar: '18g', fiber: '2g' },
        benefits: ['Natural Energy Boost', 'Rich in Vitamins', 'Great Taste', 'Refreshing & Hydrating']
    }
];

const deliveryPartners = [
    {
        name: 'Ravi Kumar',
        phone: '+91 9876543210',
        rating: 4.8,
        image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop'
    },
    {
        name: 'Priya Sharma',
        phone: '+91 9876543211',
        rating: 4.6,
        image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop'
    }
];

async function seed() {
    console.log("🌱 Starting database seed...\n");

    try {
        // Clear existing data (optional)
        // await pool.query("DELETE FROM products");
        // await pool.query("DELETE FROM delivery_partners");

        // Insert products
        console.log("📦 Inserting/Updating products...");
        for (const product of products) {
            const exists = await pool.query(
                "SELECT id FROM products WHERE name = $1 AND volume = $2",
                [product.name, product.volume]
            );

            if (exists.rows.length > 0) {
                // Update existing product with images
                await pool.query(`
                    UPDATE products SET images = $1 WHERE id = $2
                `, [product.images || [product.image_url], exists.rows[0].id]);
                console.log(`  ✓ Updated images: ${product.name}`);
                continue;
            }

            await pool.query(`
        INSERT INTO products (name, description, price, original_price, discount, category, image_url, images, volume, stock, rating, nutrition, benefits, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
      `, [
                product.name,
                product.description,
                product.price,
                product.original_price,
                product.discount,
                product.category,
                product.image_url,
                product.images || [product.image_url],
                product.volume,
                product.stock,
                product.rating,
                JSON.stringify(product.nutrition),
                product.benefits
            ]);
            console.log(`  ✓ Inserted: ${product.name}`);
        }

        // Insert delivery partners
        console.log("\n🚚 Inserting delivery partners...");
        for (const partner of deliveryPartners) {
            const exists = await pool.query(
                "SELECT id FROM delivery_partners WHERE phone = $1",
                [partner.phone]
            );

            if (exists.rows.length > 0) {
                console.log(`  ⏭ Skipped: ${partner.name} (already exists)`);
                continue;
            }

            await pool.query(`
        INSERT INTO delivery_partners (name, phone, rating, image_url, is_available)
        VALUES ($1, $2, $3, $4, true)
      `, [partner.name, partner.phone, partner.rating, partner.image_url]);
            console.log(`  ✓ Inserted: ${partner.name}`);
        }

        console.log("\n✅ Database seed completed!");
    } catch (err) {
        console.error("❌ Seed failed:", err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seed();
