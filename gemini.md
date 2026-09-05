# Project Constitution (`gemini.md`)

## 🏛️ Architectural Invariants & Core Rules
- **Framework:** B.L.A.S.T. Protocol (Blueprint, Link, Architect, Stylize, Trigger)
- **Layered Architecture:** A.N.T. (Architecture / Navigation / Tools)
- **Data-First Rule:** All input/output JSON schemas must be strictly defined here before tool implementation.
- **Deterministic Logic:** Business logic is deterministic; frontend & backend validate constraints strictly.
- **Ephemeral Storage:** All intermediate processing occurs in `.tmp/`.

---

## 📊 Data Schemas (Input / Output Payloads)

### 1. Booking Request Input Schema (Frontend -> Backend / Webhook)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BookingRequest",
  "type": "object",
  "properties": {
    "client": {
      "type": "object",
      "properties": {
        "fullName": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "phone": { "type": "string" },
        "userId": { "type": "string" }
      },
      "required": ["fullName", "email", "phone"]
    },
    "vehicle": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "enum": ["sedan_hatchback", "suv_mediana", "pickup_suv_grande"]
        },
        "brand": { "type": "string" },
        "model": { "type": "string" },
        "year": { "type": "integer" },
        "plate": { "type": "string" }
      },
      "required": ["category"]
    },
    "services": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "durationMinutes": { "type": "integer", "minimum": 1 }
        },
        "required": ["id", "name", "durationMinutes"]
      },
      "minItems": 1
    },
    "schedule": {
      "type": "object",
      "properties": {
        "date": { "type": "string", "format": "date" },
        "time": { "type": "string", "pattern": "^(0[8-9]|1[0-7]):[0-5][0-9]$" }
      },
      "required": ["date", "time"]
    },
    "location": {
      "type": "object",
      "properties": {
        "city": {
          "type": "string",
          "enum": ["Asunción", "Luque", "San Lorenzo"]
        },
        "address": { "type": "string" },
        "notes": { "type": "string" }
      },
      "required": ["city", "address"]
    },
    "pricing": {
      "type": "object",
      "properties": {
        "totalMinutes": { "type": "integer" },
        "hourlyRateGs": { "type": "integer", "default": 100000 },
        "totalPriceGs": { "type": "integer" },
        "paymentMethod": { "type": "string", "enum": ["pay_on_completion"] }
      },
      "required": ["totalMinutes", "totalPriceGs", "paymentMethod"]
    }
  },
  "required": ["client", "vehicle", "services", "schedule", "location", "pricing"]
}
```

### 2. Backend Response Payload Schema (`backend.gs` / Supabase response)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BookingResponse",
  "type": "object",
  "properties": {
    "status": { "type": "string", "enum": ["success", "error"] },
    "statusCode": { "type": "integer" },
    "message": { "type": "string" },
    "data": {
      "type": "object",
      "properties": {
        "bookingId": { "type": "string" },
        "calendarEventId": { "type": "string" },
        "sheetRow": { "type": "integer" },
        "scheduledStart": { "type": "string", "format": "date-time" },
        "scheduledEnd": { "type": "string", "format": "date-time" },
        "totalPriceGs": { "type": "integer" }
      }
    },
    "errors": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["status", "statusCode", "message"]
}
```

### 3. Customer & Manager Dashboard Payload Schema
```json
{
  "vehicle": {
    "id": "veh_123",
    "brand": "Honda",
    "model": "CR-V",
    "year": 2022,
    "plate": "ABC 123",
    "category": "suv_mediana",
    "stats": {
      "lastServiceDate": "2026-08-15",
      "nextAppointment": "2026-09-10",
      "frequency": "Mensual",
      "totalSpentGs": 600000
    }
  }
}
```

---

## 🛡️ Behavioral Rules & Constraints
1. **Operating Days:** Closed strictly on Sundays (`dayOfWeek === 0`). Datepickers must disable Sundays in Frontend and Backend must reject any Sunday payload.
2. **Operating Hours:** 08:00 to 18:00. Any service slot starting + duration must not exceed 18:00.
3. **Geographical Whitelist:** Only `Asunción`, `Luque`, and `San Lorenzo`. All other locations must be blocked.
4. **Pricing Determinism:** `totalPriceGs = (totalMinutes / 60) * 100,000 Gs`.
5. **Vehicle Categories:** Only `sedan_hatchback`, `suv_mediana`, `pickup_suv_grande`. Motorcycles strictly excluded.
6. **Payment Policy:** No payment gateway; "Pago al finalizar el servicio".

---

## 🔧 Maintenance Log & Integrations
- **Status:** Phase 1 Complete (Blueprint Established)
- **Integrations:**
  - Google Apps Script (`backend.gs`) / Google Sheets / Google Calendar
  - Supabase & Firebase Auth (Email/Pass, Google, Facebook OAuth)
  - Google Maps Places / Geolocation
