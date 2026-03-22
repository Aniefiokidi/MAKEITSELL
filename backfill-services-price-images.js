const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/makeitsell';
const APPLY_MODE = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;

const ServiceSchema = new mongoose.Schema({}, { strict: false, collection: 'services' });
const Service = mongoose.models.Service || mongoose.model('Service', ServiceSchema);

function asNonEmptyStrings(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function normalizeFromPackages(serviceDoc) {
  const rawPackages = Array.isArray(serviceDoc.packageOptions) ? serviceDoc.packageOptions : [];
  const activePackages = rawPackages.filter((pkg) => pkg && pkg.active !== false);

  const validPackagePrices = activePackages
    .map((pkg) => Number(pkg && pkg.price))
    .filter((price) => Number.isFinite(price) && price > 0);

  const packageImages = uniqueStrings(
    activePackages.flatMap((pkg) => asNonEmptyStrings(pkg && pkg.images))
  );

  const currentPrice = Number(serviceDoc.price);
  const currentImages = asNonEmptyStrings(serviceDoc.images);
  const providerImage = typeof serviceDoc.providerImage === 'string' && serviceDoc.providerImage.trim()
    ? serviceDoc.providerImage.trim()
    : '';

  const normalizedPrice = validPackagePrices.length > 0
    ? Math.min(...validPackagePrices)
    : (Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null);

  const normalizedImages = currentImages.length > 0
    ? currentImages
    : (packageImages.length > 0 ? packageImages : (providerImage ? [providerImage] : []));

  return {
    normalizedPrice,
    normalizedImages,
    hasPriceFix: normalizedPrice !== null && normalizedPrice !== currentPrice,
    hasImageFix: JSON.stringify(normalizedImages) !== JSON.stringify(currentImages),
  };
}

async function backfillServices() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  console.log(APPLY_MODE ? 'Mode: APPLY (writes enabled)' : 'Mode: DRY RUN (no writes)');

  const query = {};
  let cursorQuery = Service.find(query).lean();
  if (Number.isFinite(LIMIT) && LIMIT > 0) {
    cursorQuery = cursorQuery.limit(LIMIT);
  }

  const services = await cursorQuery;
  console.log(`Scanned ${services.length} service records`);

  const bulkOps = [];
  let needsPriceFix = 0;
  let needsImageFix = 0;
  let needsAnyFix = 0;

  for (const service of services) {
    const { normalizedPrice, normalizedImages, hasPriceFix, hasImageFix } = normalizeFromPackages(service);
    if (!hasPriceFix && !hasImageFix) continue;

    needsAnyFix += 1;
    if (hasPriceFix) needsPriceFix += 1;
    if (hasImageFix) needsImageFix += 1;

    const setPatch = { updatedAt: new Date() };
    if (hasPriceFix && normalizedPrice !== null) setPatch.price = normalizedPrice;
    if (hasImageFix) setPatch.images = normalizedImages;

    bulkOps.push({
      updateOne: {
        filter: { _id: service._id },
        update: { $set: setPatch },
      },
    });
  }

  console.log(`Services needing any fix: ${needsAnyFix}`);
  console.log(`- Price fixes: ${needsPriceFix}`);
  console.log(`- Image fixes: ${needsImageFix}`);

  if (!APPLY_MODE) {
    console.log('Dry run complete. Re-run with --apply to write updates.');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    return;
  }

  if (bulkOps.length === 0) {
    console.log('No updates needed.');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    return;
  }

  const result = await Service.bulkWrite(bulkOps, { ordered: false });
  console.log('Bulk update complete');
  console.log(`- matchedCount: ${result.matchedCount || 0}`);
  console.log(`- modifiedCount: ${result.modifiedCount || 0}`);

  await mongoose.connection.close();
  console.log('MongoDB connection closed');
}

backfillServices().catch(async (error) => {
  console.error('Backfill failed:', error);
  try {
    await mongoose.connection.close();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});
