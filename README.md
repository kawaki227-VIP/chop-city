# CHOP CITY V7 — BY KAWAKI227

Version Vercel avec Blob, Telegram, modération, statistiques, favoris, produits populaires, badge Nouveau, À la une, partage produit, galerie photos et PWA.

## Déploiement
1. Remplace les fichiers du dépôt GitHub par ceux de ce dossier.
2. Vercel redéploie automatiquement.
3. Conserve les variables existantes.
4. Le Blob doit utiliser `CHOPBLOB_READ_WRITE_TOKEN` et `CHOPBLOB_STORE_ID`.
5. `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_KEY`, `WHATSAPP_NUMBER` restent côté Vercel.

Les nouveaux produits sont **pending** et n'apparaissent publiquement qu'après validation admin via PUT avec `status=approved`.
