const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const dns = require("dns")

const OUTPUT_DIR = path.join(process.cwd(), "downloads", "brand-assets")
const CONCURRENCY = 6

function loadEnvFromDotLocal() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const eqIndex = line.indexOf("=")
    if (eqIndex < 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function sanitizeName(value) {
  return String(value || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "asset"
}

function isValidRemoteUrl(value) {
  if (!value || typeof value !== "string") return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("/")) return false
  if (trimmed.includes("placeholder.svg")) return false

  try {
    const u = new URL(trimmed)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

function detectExtFromUrl(url) {
  try {
    const u = new URL(url)
    const p = u.pathname.toLowerCase()
    if (p.endsWith(".png")) return ".png"
    if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return ".jpg"
    if (p.endsWith(".webp")) return ".webp"
    if (p.endsWith(".gif")) return ".gif"
    if (p.endsWith(".svg")) return ".svg"
    if (p.endsWith(".avif")) return ".avif"
  } catch {
    // ignore
  }
  return ""
}

function detectExtFromContentType(contentType) {
  const ct = String(contentType || "").toLowerCase()
  if (ct.includes("image/png")) return ".png"
  if (ct.includes("image/jpeg")) return ".jpg"
  if (ct.includes("image/webp")) return ".webp"
  if (ct.includes("image/gif")) return ".gif"
  if (ct.includes("image/svg+xml")) return ".svg"
  if (ct.includes("image/avif")) return ".avif"
  if (ct.includes("application/pdf")) return ".pdf"
  return ""
}

function makeFilename(entry, index, contentType) {
  const base = [
    sanitizeName(entry.collection),
    sanitizeName(entry.assetType),
    sanitizeName(entry.entityName || entry.entityId),
    String(index + 1).padStart(4, "0"),
  ].join("_")

  const ext = detectExtFromUrl(entry.url) || detectExtFromContentType(contentType) || ".bin"
  return `${base}${ext}`
}

async function connectDatabase() {
  loadEnvFromDotLocal()
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/gote-marketplace"
  const dnsServers = (process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)

  if (mongoUri.startsWith("mongodb+srv://") && dnsServers.length > 0) {
    dns.setServers(dnsServers)
    console.log(`Using DNS servers: ${dnsServers.join(", ")}`)
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 12000,
      maxPoolSize: 20,
    })
  } catch (error) {
    const message = String(error && error.message ? error.message : error)
    const isSrvDnsError =
      mongoUri.startsWith("mongodb+srv://") &&
      (message.includes("querySrv ECONNREFUSED") || message.includes("querySrv ENOTFOUND") || message.includes("querySrv ETIMEOUT"))

    if (!isSrvDnsError) {
      throw error
    }

    console.warn("SRV DNS lookup failed; trying direct-host fallback...")
    const directUri = await buildDirectMongoUriFromSrv(mongoUri, dnsServers)
    await mongoose.connect(directUri, {
      serverSelectionTimeoutMS: 12000,
      maxPoolSize: 20,
    })
  }

  return mongoose.connection.db
}

async function buildDirectMongoUriFromSrv(srvUri, dnsServers) {
  const parsed = new URL(srvUri)
  const resolver = new dns.promises.Resolver()
  if (dnsServers.length > 0) {
    resolver.setServers(dnsServers)
  }

  const hostname = parsed.hostname
  const dbName = parsed.pathname && parsed.pathname !== "/"
    ? parsed.pathname.replace(/^\//, "")
    : (process.env.MONGODB_DB_NAME || "test")

  const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`)
  if (!Array.isArray(srvRecords) || srvRecords.length === 0) {
    throw new Error("No MongoDB SRV records found.")
  }

  const hosts = srvRecords
    .sort((a, b) => a.priority - b.priority)
    .map((r) => `${r.name}:${r.port}`)
    .join(",")

  const params = new URLSearchParams(parsed.searchParams)
  if (!params.has("retryWrites")) params.set("retryWrites", "true")
  if (!params.has("w")) params.set("w", "majority")
  if (!params.has("tls")) params.set("tls", "true")

  try {
    const txtRecords = await resolver.resolveTxt(hostname)
    if (Array.isArray(txtRecords) && txtRecords.length > 0) {
      const atlasTxt = txtRecords[0].join("")
      const atlasParams = new URLSearchParams(atlasTxt)
      atlasParams.forEach((value, key) => {
        if (!params.has(key)) params.set(key, value)
      })
    }
  } catch {
    // Optional TXT lookup
  }

  const username = parsed.username ? encodeURIComponent(decodeURIComponent(parsed.username)) : ""
  const password = parsed.password ? encodeURIComponent(decodeURIComponent(parsed.password)) : ""
  const auth = username ? `${username}${password ? `:${password}` : ""}@` : ""

  return `mongodb://${auth}${hosts}/${dbName}?${params.toString()}`
}

function collectAssets(stores, users) {
  const dedupe = new Map()

  const add = (url, payload) => {
    if (!isValidRemoteUrl(url)) return
    const key = url.trim()
    if (!dedupe.has(key)) {
      dedupe.set(key, { ...payload, url: key })
    }
  }

  for (const store of stores) {
    const name = store.storeName || store.name || "store"
    const id = String(store._id || "")

    add(store.logo, {
      collection: "stores",
      entityId: id,
      entityName: name,
      assetType: "logo",
      field: "logo",
    })

    add(store.storeImage, {
      collection: "stores",
      entityId: id,
      entityName: name,
      assetType: "logo",
      field: "storeImage",
    })

    add(store.profileImage, {
      collection: "stores",
      entityId: id,
      entityName: name,
      assetType: "profile-card",
      field: "profileImage",
    })
  }

  for (const user of users) {
    const name = user.displayName || user.name || user.email || "user"
    const id = String(user._id || "")

    add(user.profileImage, {
      collection: "users",
      entityId: id,
      entityName: name,
      assetType: "profile-card",
      field: "profileImage",
    })
  }

  return [...dedupe.values()]
}

async function downloadOne(entry, index) {
  const response = await fetch(entry.url, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || ""
  const filename = makeFilename(entry, index, contentType)
  const outPath = path.join(OUTPUT_DIR, filename)

  const arrBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrBuffer)
  fs.writeFileSync(outPath, buffer)

  return {
    ...entry,
    filename,
    outputPath: outPath,
    bytes: buffer.length,
    contentType,
    status: "downloaded",
  }
}

async function runWithConcurrency(entries, worker, limit) {
  const results = new Array(entries.length)
  let cursor = 0

  async function next() {
    while (true) {
      const idx = cursor
      cursor += 1
      if (idx >= entries.length) return
      try {
        results[idx] = await worker(entries[idx], idx)
      } catch (error) {
        results[idx] = {
          ...entries[idx],
          status: "failed",
          error: String(error && error.message ? error.message : error),
        }
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => next())
  await Promise.all(workers)
  return results
}

function writeManifest(results) {
  const jsonPath = path.join(OUTPUT_DIR, "manifest.json")
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8")

  const csvHeader = [
    "status",
    "collection",
    "entityId",
    "entityName",
    "assetType",
    "field",
    "url",
    "filename",
    "contentType",
    "bytes",
    "error",
  ]

  const rows = [csvHeader.join(",")]
  for (const item of results) {
    const row = [
      item.status || "",
      item.collection || "",
      item.entityId || "",
      item.entityName || "",
      item.assetType || "",
      item.field || "",
      item.url || "",
      item.filename || "",
      item.contentType || "",
      item.bytes == null ? "" : String(item.bytes),
      item.error || "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`)

    rows.push(row.join(","))
  }

  const csvPath = path.join(OUTPUT_DIR, "manifest.csv")
  fs.writeFileSync(csvPath, rows.join("\n"), "utf8")
}

async function main() {
  ensureDirectory(OUTPUT_DIR)

  const db = await connectDatabase()

  const stores = await db.collection("stores").find({}, {
    projection: { _id: 1, storeName: 1, name: 1, logo: 1, storeImage: 1, profileImage: 1 },
  }).toArray()

  const users = await db.collection("users").find({}, {
    projection: { _id: 1, email: 1, name: 1, displayName: 1, profileImage: 1 },
  }).toArray()

  const assets = collectAssets(stores, users)

  console.log(`Found ${assets.length} unique remote logo/profile assets.`)
  if (assets.length === 0) {
    console.log("No downloadable assets found.")
    return
  }

  const results = await runWithConcurrency(assets, downloadOne, CONCURRENCY)
  writeManifest(results)

  const downloaded = results.filter((r) => r.status === "downloaded")
  const failed = results.filter((r) => r.status === "failed")

  console.log(`Downloaded: ${downloaded.length}`)
  console.log(`Failed: ${failed.length}`)
  console.log(`Output folder: ${OUTPUT_DIR}`)
  console.log(`Manifest: ${path.join(OUTPUT_DIR, "manifest.csv")}`)

  if (failed.length > 0) {
    console.log("First few failures:")
    failed.slice(0, 10).forEach((f, i) => {
      console.log(`${i + 1}. ${f.url} -> ${f.error}`)
    })
  }
}

main()
  .catch((error) => {
    console.error("Download failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await mongoose.disconnect()
    } catch {
      // ignore
    }
  })
