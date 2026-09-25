# CHOP CITY — Vercel Edition

Marketplace CHOP CITY — BY KAWAKI227.

## Déploiement Vercel

1. Importe ce projet dans Vercel.
2. Dans **Storage**, crée un **Blob Store** et connecte-le au projet.
3. Ajoute les variables d'environnement :
   - `BLOB_READ_WRITE_TOKEN`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `ADMIN_KEY`
   - `WHATSAPP_NUMBER` (facultatif, par défaut 22781289418)
4. Redéploie.

## Sécurité

Le panneau Admin utilise `ADMIN_KEY`. Les routes de modification/suppression vérifient cette clé côté serveur.

Le token Telegram n'est jamais envoyé au navigateur.

## Stockage

Les produits et les images sont stockés dans Vercel Blob, donc ils ne dépendent pas du disque temporaire de la fonction Vercel.

## Important

Le formulaire « Vendre » est public : les visiteurs peuvent proposer un produit. Le produit est visible immédiatement. Si tu veux une validation admin avant publication, active le mode modération dans le code.
