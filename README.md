# Attendance Managment Dashboard

BarberFlow is a modern staff management and attendance tracking dashboard built to manage daily check-ins, check-outs, QR-based attendance validation, and incident reporting for barbershops and similar businesses.

The system is designed with security, scalability, and real-world workflows in mind and integrates tightly with Supabase for authentication, database, and edge functions.

---

## Features

- 🔐 Secure authentication using Supabase Auth  
- 📅 Daily QR code generation for attendance tracking  
- 📲 QR-based check-in and check-out flow  
- ⚠️ Incident logging and tracking  
- 👥 Worker management with owner-based access control (RLS)  
- 📊 Attendance history and status visibility  
- ✉️ Optional QR delivery via email (SMTP / Resend supported)  

---

## Tech Stack

- **Frontend:** React + TypeScript  
- **Build Tool:** Vite  
- **UI:** Tailwind CSS + shadcn/ui  
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)  

---

## Project Structure

src/
components/ # Reusable UI components
pages/ # Application pages
integrations/ # Supabase client & external services
supabase/
functions/ # Edge functions (QR, attendance, email)

yaml
Copy code

---

## Getting Started (Local Development)

### Prerequisites

- Node.js (v18+ recommended)
- npm or pnpm
- Supabase project (URL + anon key)
