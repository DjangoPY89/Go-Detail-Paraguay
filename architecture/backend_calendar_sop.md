# SOP: Google Apps Script Backend & Calendar Conflict Engine

## 1. Goal
Process booking requests deterministically, validate geo-fences and calendar availability, log entries in Google Sheets, and create Google Calendar events.

## 2. Execution Pipeline (`doPost(e)`)
1. **Payload Extraction & CORS:**
   - Parse `e.postData.contents` into JSON.
   - Return CORS-enabled headers for web integration.

2. **Validation Gates:**
   - Gate 1: Check city in `["Asunción", "Luque", "San Lorenzo"]`.
   - Gate 2: Check date is not Sunday (`new Date(date).getDay() !== 0`).
   - Gate 3: Check start time >= 08:00 and `startTime + totalMinutes <= 18:00`.
   - If any gate fails, return HTTP 400 with descriptive error array.

3. **Calendar Conflict Detection:**
   - Get calendar by ID (`CalendarApp.getDefaultCalendar()` or configured ID).
   - Fetch events between `requestedStart` and `requestedEnd`.
   - If `events.length > 0`, return HTTP 409 conflict message proposing alternate slots.

4. **Persistence:**
   - Append row to target Google Sheet with: `Booking ID`, `Timestamp`, `Client Name`, `Phone`, `Email`, `City`, `Address`, `Vehicle`, `Services`, `Duration (min)`, `Total Price (Gs.)`, `Status (CONFIRMED)`.
   - Create Google Calendar Event with title: `[Detailing] {Client Name} - {Vehicle}`.

5. **Response Payload:**
   - Return JSON conforming to `BookingResponse` schema defined in `gemini.md`.
