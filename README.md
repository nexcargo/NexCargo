# NexCargo
Enterprise-grade cargo marketplace platform built with Next.js, TypeScript, Tailwind CSS, and Supabase. Features AI-assisted freight matching, multi-tenant architecture, secure payments, real-time tracking, and role-based access for shippers, carriers, and brokers.

# NexCargo
### The CargoLink Marketplace

> AI-powered digital freight marketplace connecting shippers, transporters, and cargo brokers.

---

## Overview

NexCargo is a modern logistics platform designed to simplify cargo transportation by connecting cargo owners, transport companies, and freight brokers through a secure digital marketplace.

The platform automates freight matching, quotation requests, booking, shipment tracking, payments, and communication while maintaining enterprise-grade security and scalability.

Although initially developed for Mozambique, NexCargo is designed as a multi-country platform capable of expanding across Southern Africa and beyond.

---

## Key Features

- 🚚 Cargo Marketplace
- 🤝 AI-assisted Freight Matching
- 📍 Real-time Shipment Tracking
- 💳 Secure Payment Integration
- 🏢 Multi-Tenant Architecture
- 👤 Role-Based Access Control
- 🌍 Multi-language Support
- 📱 Mobile Friendly
- 🔒 Enterprise Security
- 📊 Analytics & Reporting
- 🔔 Real-time Notifications
- 📄 Digital Documentation

---

## Technology Stack

### Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS

### Backend

- Supabase
- PostgreSQL
- Row Level Security (RLS)
- Edge Functions

### Authentication

- Supabase Auth
- JWT
- Role-Based Permissions

### AI

- AI-assisted load matching
- Intelligent search
- Recommendation engine

---

## Architecture

```
                +------------------+
                |     Web App      |
                +---------+--------+
                          |
                +---------v--------+
                |     Next.js      |
                +---------+--------+
                          |
          +---------------+----------------+
          |                                |
+---------v--------+             +---------v--------+
|   Supabase Auth  |             |    PostgreSQL    |
+------------------+             +------------------+
          |                                |
          +---------------+----------------+
                          |
                +---------v--------+
                |   Edge Functions |
                +---------+--------+
                          |
                +---------v--------+
                | External Services|
                +------------------+
```

---

## Project Status

Current Phase:

- Documentation
- System Architecture
- Core Development

Upcoming:

- User Authentication
- Marketplace Core
- Booking System
- Payment Integration
- Mobile Application

---

## Repository Structure

```
.
├── app/
├── components/
├── lib/
├── public/
├── styles/
├── types/
├── docs/
├── scripts/
├── supabase/
├── tests/
└── README.md
```

---

## Getting Started

### Requirements

- Node.js 22+
- npm
- Git
- Supabase Account

### Installation

Clone the repository:

```bash
git clone https://github.com/<your-org>/nexcargo.git
```

Enter the project:

```bash
cd nexcargo
```

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=

NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
```

---

## Security

NexCargo follows security-first principles including:

- Row Level Security (RLS)
- Least-Privilege Access
- Secure Authentication
- Secure APIs
- Audit Logging
- Input Validation

---

## Documentation

Project documentation can be found inside the `docs/` directory.

It includes:

- System Specifications
- Architecture
- API Documentation
- Database Design
- Event Registry
- Development Standards

---

## Contributing

Contributions are welcome.

Please:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a Pull Request.

---

## Roadmap

- Authentication
- Company Management
- Cargo Listings
- Load Matching
- Booking
- Driver App
- Tracking
- Payments
- Notifications
- Analytics
- AI Services

---

## License

This project is......

---

## Author

**NexCargo Development Team**

Building the future of digital freight logistics.
