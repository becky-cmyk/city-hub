import pg from "pg";

const OLD_KEY = "AIzaSyCEW7y_Uy3kiHF6EwxhM9uzhN09tiRTiAY";

async function main() {
  const newKey = process.env.GOOGLE_MAPS_API_KEY || process.env.googel_API_Places || process.env.GOOGLE_PLACES_API_KEY;
  if (!newKey) {
    console.error("No Google Places API key found in environment");
    process.exit(1);
  }

  if (newKey === OLD_KEY) {
    console.error("New key is the same as old key — nothing to do");
    process.exit(0);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM businesses WHERE image_url LIKE '%maps.googleapis.com/maps/api/place/photo%'"
    );
    console.log(`Found ${countResult.rows[0].count} rows with Google Places photo URLs`);

    const updateResult = await pool.query(
      `UPDATE businesses 
       SET image_url = REPLACE(image_url, $1, $2) 
       WHERE image_url LIKE '%maps.googleapis.com/maps/api/place/photo%'`,
      [OLD_KEY, newKey]
    );

    console.log(`Updated ${updateResult.rowCount} rows`);

    const verifyResult = await pool.query(
      "SELECT COUNT(*) FROM businesses WHERE image_url LIKE $1",
      [`%${OLD_KEY}%`]
    );
    console.log(`Remaining rows with old key: ${verifyResult.rows[0].count}`);

    const sampleResult = await pool.query(
      "SELECT id, image_url FROM businesses WHERE image_url LIKE '%maps.googleapis.com/maps/api/place/photo%' LIMIT 2"
    );
    for (const row of sampleResult.rows) {
      console.log(`Sample: ${row.image_url.substring(0, 120)}...`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
