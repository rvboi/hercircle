# HerCircle

A multi-role women's health and wellness platform that combines a consumer marketplace for menstrual care products, cycle tracking, health education, and a B2B supply chain connecting administrators, distributors, and pharmacies.

## Features

### Customer

- **Shop** — Browse and purchase period care, wellness supplements, and hygiene products with search, filters, wishlists, and cart
- **Cycle Tracker** — Calendar-based menstrual cycle tracking with flow intensity, symptoms, mood, and cycle predictions
- **FlowBot** — AI-powered chatbot for menstrual health questions covering PCOS, PMS, contraception, and more
- **FlowLearn** — Educational content library with articles on cycle basics, product guides, nutrition, and myth-busting
- **Profile** — Manage orders, wishlists, addresses, and payment methods

### Admin

- **Dashboard** — KPIs for revenue, orders, distributors, pharmacies, and pending approvals
- **Product Management** — Add/edit products with MOQ support, images, and bulk Excel imports
- **Supplier Management** — Approve or reject distributor and pharmacy applications
- **Order Tracking** — Monitor distributor and pharmacy orders with status workflows
- **Mapping** — Assign distributors to pharmacies

### Distributor

- **Catalogue** — Browse the master product list and place bulk orders to admin
- **Pharmacy Network** — View assigned pharmacies and manage relationships
- **Order Management** — Fulfill and track pharmacy orders
- **Stock Management** — Monitor inventory levels

### Pharmacy

- **Dashboard** — Stats for pending orders, low stock, out-of-stock items, and daily revenue
- **Inventory** — Manage stock levels with reorder alerts
- **Catalog** — Browse products to add to inventory
- **Orders** — Receive and manage orders from distributors

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [React Native](https://reactnative.dev/) with [Expo](https://expo.dev) (SDK 53) |
| Language | TypeScript |
| Routing | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| Local Storage | AsyncStorage |
| Linting | ESLint with eslint-config-expo |

## Project Structure

```
app/
├── (auth)/          # Login & signup screens (customer, pharmacy, distributor)
├── (tabs)/          # Customer tabs: shop, tracker, flowbot, learn, profile
├── admin/           # Admin dashboard, orders, product & supplier management
├── distributor/     # Distributor dashboard, catalogue, stock, orders
├── pharmacy/        # Pharmacy dashboard, inventory, catalog, orders
├── onboarding/      # Health quiz onboarding flow
└── product/         # Product detail screen
components/          # Reusable UI components
context/             # Auth context & protected route logic
lib/                 # Supabase client configuration
constants/           # Theme colors
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root with your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Running the App

```bash
# Start the Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web
```

### Linting

```bash
npm run lint
```
