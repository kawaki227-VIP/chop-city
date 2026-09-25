import express from "express";
import multer from "multer";
import { put, list, del } from "@vercel/blob";
import crypto from "node:crypto";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.json({ limit: "1mb" }));

const ADMIN_KEY = process.env.ADMIN_KEY || "";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "22781289418";
const PRODUCTS_FILE = "chop-city/products.json";

function adminOk(req) {
  const key = req.headers["x-admin-key"];
  return Boolean(ADMIN_KEY) && key === ADMIN_KEY;
}

async function getBlobUrl(pathname) {
  const result = await list({ prefix: pathname });
  return result.blobs?.find(b => b.pathname === pathname)?.url || null;
}

async function readProducts() {
  const url = await getBlobUrl(PRODUCTS_FILE);
  if (!url) return [];
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveProducts(products) {
  await put(PRODUCTS_FILE, JSON.stringify(products, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true
  });
}

async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
  } catch (e) {
    console.error("Telegram error:", e);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "CHOP CITY", version: "3.0.0" });
});

app.get("/api/config", (_req, res) => {
  res.json({ whatsapp: WHATSAPP_NUMBER });
});

app.get("/api/products", async (_req, res) => {
  try {
    const products = await readProducts();
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Impossible de charger les produits." });
  }
});

app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    const { name, price, seller, category, description, whatsapp } = req.body;

    if (!name || !price || !seller || !description) {
      return res.status(400).json({ error: "Nom, prix, vendeur et description sont obligatoires." });
    }

    let image = "";
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Le fichier doit être une image." });
      }
      const ext = (req.file.originalname.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
      const blob = await put(
        `chop-city/products/${crypto.randomUUID()}.${ext || "jpg"}`,
        req.file.buffer,
        {
          access: "public",
          contentType: req.file.mimetype
        }
      );
      image = blob.url;
    }

    const product = {
      id: crypto.randomUUID(),
      name: String(name).trim().slice(0, 100),
      price: String(price).trim().slice(0, 50),
      seller: String(seller).trim().slice(0, 80),
      category: String(category || "Autre").trim().slice(0, 40),
      description: String(description).trim().slice(0, 1200),
      image,
      whatsapp: String(whatsapp || WHATSAPP_NUMBER).replace(/[^\d+]/g, ""),
      createdAt: new Date().toISOString()
    };

    const products = await readProducts();
    products.unshift(product);
    await saveProducts(products);

    await notifyTelegram(
      `🛍️ NOUVEAU PRODUIT — CHOP CITY\n\n` +
      `📦 ${product.name}\n` +
      `💰 ${product.price}\n` +
      `👤 ${product.seller}\n` +
      `🏷️ ${product.category}\n` +
      `📝 ${product.description}\n` +
      `📱 WhatsApp: ${product.whatsapp}`
    );

    res.status(201).json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de l'ajout du produit." });
  }
});

app.put("/api/products/:id", upload.single("image"), async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Clé admin invalide." });

  try {
    const products = await readProducts();
    const index = products.findIndex(p => p.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Produit introuvable." });

    const old = products[index];
    let image = old.image || "";

    if (req.file) {
      const ext = (req.file.originalname.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
      const blob = await put(
        `chop-city/products/${crypto.randomUUID()}.${ext || "jpg"}`,
        req.file.buffer,
        { access: "public", contentType: req.file.mimetype }
      );
      image = blob.url;
    }

    products[index] = {
      ...old,
      name: String(req.body.name ?? old.name).trim().slice(0, 100),
      price: String(req.body.price ?? old.price).trim().slice(0, 50),
      seller: String(req.body.seller ?? old.seller).trim().slice(0, 80),
      category: String(req.body.category ?? old.category).trim().slice(0, 40),
      description: String(req.body.description ?? old.description).trim().slice(0, 1200),
      whatsapp: String(req.body.whatsapp ?? old.whatsapp).replace(/[^\d+]/g, ""),
      image
    };

    await saveProducts(products);
    await notifyTelegram(`✏️ PRODUIT MODIFIÉ — CHOP CITY\n\n📦 ${products[index].name}\n👤 ${products[index].seller}`);

    res.json(products[index]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la modification." });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  if (!adminOk(req)) return res.status(401).json({ error: "Clé admin invalide." });

  try {
    const products = await readProducts();
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: "Produit introuvable." });

    const remaining = products.filter(p => p.id !== req.params.id);
    await saveProducts(remaining);

    await notifyTelegram(`🗑️ PRODUIT SUPPRIMÉ — CHOP CITY\n\n📦 ${product.name}\n👤 ${product.seller}`);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
});

app.post("/api/report", async (req, res) => {
  const { product, reason, message } = req.body || {};
  if (!message && !reason) return res.status(400).json({ error: "Signalement vide." });

  await notifyTelegram(
    `⚠️ SIGNALEMENT — CHOP CITY\n\n` +
    `📦 Produit: ${product || "Non précisé"}\n` +
    `📌 Motif: ${reason || "Non précisé"}\n` +
    `📝 ${message || ""}`
  );

  res.json({ ok: true });
});

export default app;
