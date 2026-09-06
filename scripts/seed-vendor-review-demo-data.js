const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const uri = process.env.MONGODB_URI;

async function main() {
  const client = await MongoClient.connect(uri);
  const db = client.db("test");

  const vendorUser = await db.collection("users").findOne({ email: "appreview.vendor@makeitsell.ng" });
  const customerUser = await db.collection("users").findOne({ email: "appreview.customer@makeitsell.ng" });
  if (!vendorUser) throw new Error("vendor review user not found");
  if (!customerUser) throw new Error("customer review user not found");

  const vendorId = String(vendorUser._id);
  const customerId = String(customerUser._id);

  let store = await db.collection("stores").findOne({ vendorId });
  const storeFields = {
    storeName: "Urban Trends NG",
    storeDescription: "Everyday fashion, accessories and home goods, curated for the Nigerian shopper.",
    category: "Fashion",
    isOpen: true,
    isActive: true,
    accountStatus: "approved",
    subscriptionStatus: "active",
    deliveryTime: "1-2 days",
    fulfillmentTime: "same_day",
    city: "Lagos",
    state: "Lagos",
    address: "14 Adeola Odeku Street, Victoria Island, Lagos",
    reviewCount: 128,
    phone: "+2348000000000",
    email: "appreview.vendor@makeitsell.ng",
  };

  if (!store) {
    const insertResult = await db.collection("stores").insertOne({
      vendorId,
      ...storeFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    store = await db.collection("stores").findOne({ _id: insertResult.insertedId });
  } else {
    await db.collection("stores").updateOne({ _id: store._id }, { $set: storeFields });
    store = { ...store, ...storeFields };
  }
  const storeId = String(store._id);

  const now = new Date();

  const products = [
    {
      name: "Classic Ankara Tote Bag",
      description: "Handwoven Ankara print tote bag with reinforced leather straps and inner zip pocket.",
      price: 8500,
      images: ["https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800"],
      vendorId,
      vendorName: store.storeName || "Urban Trends NG",
      storeId,
      category: "Fashion",
      subcategory: "Bags",
      stock: 24,
      lowStockThreshold: 3,
      sku: "UTN-BAG-001",
      featured: true,
      status: "active",
      sales: 37,
      hasColorOptions: true,
      hasSizeOptions: false,
      colors: ["Blue", "Red", "Green"],
      sizes: [],
      colorImages: {},
      compatiblePhoneModels: [],
      variants: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: "Men's Slim Fit Chinos",
      description: "Breathable cotton-blend chinos, tailored slim fit, available in multiple waist sizes.",
      price: 12000,
      images: ["https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800"],
      vendorId,
      vendorName: store.storeName || "Urban Trends NG",
      storeId,
      category: "Fashion",
      subcategory: "Men",
      stock: 40,
      lowStockThreshold: 5,
      sku: "UTN-CHN-002",
      featured: false,
      status: "active",
      sales: 52,
      hasColorOptions: true,
      hasSizeOptions: true,
      colors: ["Khaki", "Navy", "Black"],
      sizes: ["30", "32", "34", "36"],
      colorImages: {},
      compatiblePhoneModels: [],
      variants: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: "Beaded Statement Necklace",
      description: "Handmade beaded necklace with brass accents, one size fits all.",
      price: 6500,
      images: ["https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800"],
      vendorId,
      vendorName: store.storeName || "Urban Trends NG",
      storeId,
      category: "Fashion",
      subcategory: "Jewelry",
      stock: 15,
      lowStockThreshold: 3,
      sku: "UTN-NCK-003",
      featured: true,
      status: "active",
      sales: 21,
      hasColorOptions: false,
      hasSizeOptions: false,
      colors: [],
      sizes: [],
      colorImages: {},
      compatiblePhoneModels: [],
      variants: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: "Woven Storage Baskets (Set of 3)",
      description: "Natural raffia storage baskets, nesting set of three sizes for home organization.",
      price: 15500,
      images: ["https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=800"],
      vendorId,
      vendorName: store.storeName || "Urban Trends NG",
      storeId,
      category: "Home & Living",
      subcategory: "Storage",
      stock: 2,
      lowStockThreshold: 3,
      sku: "UTN-BSK-004",
      featured: false,
      status: "active",
      sales: 9,
      hasColorOptions: false,
      hasSizeOptions: false,
      colors: [],
      sizes: [],
      colorImages: {},
      compatiblePhoneModels: [],
      variants: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.collection("products").deleteMany({ storeId });
  const productResult = await db.collection("products").insertMany(products);
  const productIds = Object.values(productResult.insertedIds);

  const service = {
    providerId: vendorId,
    providerName: store.storeName || "Urban Trends NG",
    title: "Personal Styling Session",
    description: "One-on-one styling consultation to build a capsule wardrobe from our latest collection.",
    category: "Fashion",
    subcategory: "Styling",
    price: 20000,
    pricingType: "per-session",
    duration: 60,
    location: "14 Adeola Odeku Street, Victoria Island, Lagos",
    state: "Lagos",
    city: "Lagos",
    locationType: "store",
    images: ["https://images.unsplash.com/photo-1445205170230-053b83016050?w=800"],
    featured: true,
    status: "active",
    tags: ["styling", "fashion", "consultation"],
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").deleteMany({ providerId: vendorId });
  const serviceResult = await db.collection("services").insertOne(service);
  const serviceId = String(serviceResult.insertedId);

  await db.collection("bookings").deleteMany({ providerId: vendorId });
  await db.collection("bookings").insertMany([
    {
      serviceId,
      customerId,
      customerName: "App Review",
      customerEmail: "appreview.customer@makeitsell.ng",
      customerPhone: "+2348000000000",
      providerId: vendorId,
      providerName: store.storeName || "Urban Trends NG",
      serviceTitle: service.title,
      bookingDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      startTime: "11:00",
      endTime: "12:00",
      duration: 60,
      totalPrice: service.price,
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "paystack",
      locationType: "store",
      location: service.location,
      notes: "Looking forward to the session!",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const orderId1 = crypto.randomUUID();
  const orderId2 = crypto.randomUUID();

  const orderItemsPending = [
    { id: String(productIds[0]), productId: String(productIds[0]), title: products[0].name, price: products[0].price, quantity: 1, image: products[0].images[0], vendorId, storeId },
    { id: String(productIds[1]), productId: String(productIds[1]), title: products[1].name, price: products[1].price, quantity: 2, image: products[1].images[0], vendorId, storeId },
  ];
  const pendingTotal = products[0].price + products[1].price * 2;

  const orderItemsDelivered = [
    { id: String(productIds[2]), productId: String(productIds[2]), title: products[2].name, price: products[2].price, quantity: 1, image: products[2].images[0], vendorId, storeId },
  ];
  const deliveredTotal = products[2].price;

  await db.collection("orders").deleteMany({ storeIds: storeId });
  await db.collection("orders").insertMany([
    {
      orderId: orderId1,
      customerId,
      items: orderItemsPending,
      shippingAddress: { street: "22 Allen Avenue", city: "Ikeja", state: "Lagos", zipCode: "100282", country: "Nigeria", instructions: "" },
      paymentMethod: "paystack",
      totalAmount: pendingTotal,
      status: "confirmed",
      paymentStatus: "escrow",
      deliveryType: "local",
      vendors: [
        { vendorId, vendorName: store.storeName || "Urban Trends NG", storeId, items: orderItemsPending, total: pendingTotal, status: "confirmed", confirmedAt: now },
      ],
      storeIds: [storeId],
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      confirmedAt: now,
    },
    {
      orderId: orderId2,
      customerId,
      items: orderItemsDelivered,
      shippingAddress: { street: "22 Allen Avenue", city: "Ikeja", state: "Lagos", zipCode: "100282", country: "Nigeria", instructions: "" },
      paymentMethod: "paystack",
      totalAmount: deliveredTotal,
      status: "completed",
      paymentStatus: "released",
      deliveryType: "local",
      vendors: [
        { vendorId, vendorName: store.storeName || "Urban Trends NG", storeId, items: orderItemsDelivered, total: deliveredTotal, status: "received", confirmedAt: now, shippedAt: now, deliveredAt: now, receivedAt: now },
      ],
      storeIds: [storeId],
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      receivedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log("Seeded demo data for vendor review account:");
  console.log("  store:", store.storeName, storeId);
  console.log("  products:", productIds.length);
  console.log("  service:", serviceId);
  console.log("  bookings: 1 pending");
  console.log("  orders: 1 confirmed (in progress), 1 completed");

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
