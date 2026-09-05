# SOP: Frictionless Booking Flow & Hourly Pricing Engine

## 1. Goal
Provide a seamless, frictionless 4-step booking experience for Mobile Auto Detailing in Paraguay (Asunción, Luque, San Lorenzo) with transparent, real-time hourly pricing calculations.

## 2. Business Rules & Validations
- **Step 1: Vehicle Category Selection**
  - Options: `sedan_hatchback`, `suv_mediana`, `pickup_suv_grande`.
  - Motorcycles are strictly excluded.
  - Interactive visual card with full clickable area (hiding native radio controls).

- **Step 2: Service Selection & Dynamic Hourly Pricing**
  - Each service item contains a hidden duration in minutes:
    - *Detailing Completo Interior & Exterior*: 240 min (4h)
    - *Detailing Básico / Mantenimiento*: 180 min (3h)
    - *Tratamiento Acrílico / Cerámico*: 300 min (5h)
    - *Limpieza Profunda de Tapizados*: 120 min (2h)
    - *Pulido y Restauración de Faros*: 40 min (~0.67h)
    - *Lavado y Acondicionamiento de Motor*: 45 min (0.75h)
    - *Descontaminado y Encerado Express*: 60 min (1h)
  - Calculation formula:
    `totalPriceGs = (totalMinutes / 60) * 100,000 Gs`
  - Real-time UI feedback updates total hours and total Gs. price instantly as checkboxes are toggled.

- **Step 3: Location & Schedule Constraints**
  - **Coverage Whitelist:** `Asunción`, `Luque`, `San Lorenzo`. Dropdown selection activates the exact address text input.
  - **Operating Days:** Closed strictly on Sundays (`dayOfWeek === 0`).
  - **Operating Hours:** 08:00 to 18:00. Time slot plus total duration must conclude at or before 18:00.

- **Step 4: Transparent Confirmation**
  - Summary of selected vehicle, services, location, start/end time, and total Gs.
  - Clear message: "Reservar Cita - Pago al finalizar el servicio".

## 3. Error Handling
- Prevent advancement to subsequent steps if mandatory fields are missing.
- In-form toast/inline alerts for Sunday selection or out-of-bounds hours.
