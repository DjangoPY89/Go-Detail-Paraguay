# Findings & Research (`findings.md`)

## Discoveries & Constraints
- **Core Business Model:** Frictionless On-Demand Mobile Auto Detailing in Paraguay (Asunción, Luque, San Lorenzo).
- **Pricing:** Purely hourly-based (Gs. 100.000 / hr) calculated by aggregated hidden minute durations per service.
- **Calendar Collision Logic:** Dynamic slot finding from 08:00 to 18:00. Total duration is evaluated in real-time to avoid overlap with existing calendar events.
- **Multi-Role Dashboards:**
  1. Public SPA Booking Flow (Instant Quote + Scheduling).
  2. Customer Dashboard (Vehicles grid 2x2 stats, booking history, new booking trigger).
  3. Manager Dashboard (View schedule, status updates, client records).
- **Auth:** Firebase / Supabase Auth supporting Email/Password, Google OAuth, and Facebook OAuth.
