# Zoho POS & Inventory Sync App

A custom Shopify application designed to synchronize Shopify orders and inventory with Zoho POS / Inventory.

## Features

- **Order Synchronization:** Automatically listens to `orders/paid` webhooks in Shopify and syncs paid orders directly to Zoho with custom formatting.
- **Product Management:** Ability to manage and deactivate products safely across synchronized channels.
- **Webhooks Integration:** Custom background listeners for seamless inventory and order status tracking.
- **Embedded Admin UI:** Integrated Shopify Polaris interface within the Shopify Admin dashboard.

## Tech Stack

- **Framework:** React Router v7 / Node.js
- **UI Components:** Shopify Polaris & App Bridge
- **Database:** Prisma ORM with SQLite (compatible with PostgreSQL/MySQL)
- **Deployment:** Render (`https://zoho-pos-sync-app.onrender.com`)

## Setup & Local Development

### Prerequisites

- Node.js (>= 20.19)
- Shopify CLI (`npm install -g @shopify/cli@latest`)

### Getting Started

1. Install dependencies:
   ```shell
   npm install
   ```

2. Generate database client:
   ```shell
   npm run setup
   ```

3. Start local development server:
   ```shell
   npm run dev
   ```

## Webhook Subscriptions

The app registers the following webhook endpoints:
- `orders/paid` -> `/webhooks/orders/paid`
- `app/uninstalled` -> `/webhooks/app/uninstalled`
- `app/scopes_update` -> `/webhooks/app/scopes_update`

## Deployment

To deploy updates to Render or another hosting platform:

```shell
npm run build
npm run deploy
```
