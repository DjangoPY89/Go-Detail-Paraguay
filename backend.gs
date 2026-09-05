/**
 * =========================================================================
 * GO! MOBILE AUTO DETAILING - BACKEND GOOGLE APPS SCRIPT (backend.gs)
 * =========================================================================
 * Handles webhook bookings, Google Calendar conflict scans, and Google Sheets storage.
 * Protocol: B.L.A.S.T. / Schema: GEMINI.md
 */

// Global Configuration
const CONFIG = {
  GEO_WHITELIST: ["Asunción", "Luque", "San Lorenzo"],
  WORK_START_HOUR: 8,
  WORK_END_HOUR: 18,
  HOURLY_RATE_GS: 100000,
  SHEET_NAME: "Reservas",
  TIMEZONE: "America/Asuncion"
};

/**
 * Handle HTTP POST Webhook
 */
function doPost(e) {
  try {
    // 1. Parse JSON Payload
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        status: "error",
        statusCode: 400,
        message: "Cuerpo de solicitud vacío o inválido.",
        errors: ["Missing request body"]
      }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    
    // 2. Validate Business Logic & Rules
    const validation = validateBooking(payload);
    if (!validation.isValid) {
      return createJsonResponse({
        status: "error",
        statusCode: 400,
        message: "Validación fallida.",
        errors: validation.errors
      }, 400);
    }

    // 3. Compute Dates and Durations
    const schedule = payload.schedule;
    const client = payload.client;
    const vehicle = payload.vehicle;
    const services = payload.services;
    const location = payload.location;
    const pricing = payload.pricing;

    const totalMinutes = services.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const startDateTime = parseDateTime(schedule.date, schedule.time);
    const endDateTime = new Date(startDateTime.getTime() + totalMinutes * 60000);

    // 4. Calendar Conflict Detection
    const calendar = CalendarApp.getDefaultCalendar();
    const existingEvents = calendar.getEvents(startDateTime, endDateTime);

    if (existingEvents.length > 0) {
      return createJsonResponse({
        status: "error",
        statusCode: 409,
        message: "El horario seleccionado entra en conflicto con otra reserva existente en el calendario.",
        errors: ["Calendar slot already occupied. Please select an alternate time."]
      }, 409);
    }

    // 5. Create Google Calendar Event
    const eventTitle = `[Detailing] ${client.fullName} - ${vehicle.brand} ${vehicle.model} (${vehicle.category})`;
    const serviceListStr = services.map(s => `• ${s.name} (${s.durationMinutes} min)`).join("\n");
    const eventDescription = [
      `🚗 VEHÍCULO: ${vehicle.brand} ${vehicle.model} ${vehicle.year || ""} | Placa: ${vehicle.plate || "N/A"}`,
      `👤 CLIENTE: ${client.fullName}`,
      `📞 TELÉFONO: ${client.phone}`,
      `✉️ EMAIL: ${client.email}`,
      `📍 UBICACIÓN: ${location.address}, ${location.city}`,
      location.notes ? `📝 NOTAS: ${location.notes}` : "",
      `⏱️ DURACIÓN TOTAL: ${totalMinutes} minutos (${(totalMinutes/60).toFixed(1)} horas)`,
      `💰 TOTAL A COBRAR: Gs. ${pricing.totalPriceGs.toLocaleString("es-PY")}`,
      `💳 MÉTODO DE PAGO: Pago al finalizar el servicio`,
      `\n🛠️ SERVICIOS SELECCIONADOS:\n${serviceListStr}`
    ].filter(Boolean).join("\n");

    const newEvent = calendar.createEvent(
      eventTitle,
      startDateTime,
      endDateTime,
      {
        description: eventDescription,
        location: `${location.address}, ${location.city}`
      }
    );

    // 6. Save Record to Google Sheets
    const bookingId = "BK-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    const sheetRowIndex = appendToSheet(bookingId, payload, totalMinutes, startDateTime, endDateTime, newEvent.getId());

    // 7. Return Success Response
    return createJsonResponse({
      status: "success",
      statusCode: 200,
      message: "Reserva confirmada con éxito.",
      data: {
        bookingId: bookingId,
        calendarEventId: newEvent.getId(),
        sheetRow: sheetRowIndex,
        scheduledStart: startDateTime.toISOString(),
        scheduledEnd: endDateTime.toISOString(),
        totalPriceGs: pricing.totalPriceGs
      }
    }, 200);

  } catch (error) {
    return createJsonResponse({
      status: "error",
      statusCode: 500,
      message: "Error interno del servidor: " + error.toString(),
      errors: [error.message || error.toString()]
    }, 500);
  }
}

/**
 * Handle HTTP GET (Health Check / Status)
 */
function doGet(e) {
  return createJsonResponse({
    status: "success",
    statusCode: 200,
    message: "Go! Detailing API Endpoint is operational.",
    timestamp: new Date().toISOString()
  }, 200);
}

/**
 * Business Rule Validator
 */
function validateBooking(payload) {
  const errors = [];

  // Required Sections
  if (!payload.client || !payload.vehicle || !payload.services || !payload.schedule || !payload.location || !payload.pricing) {
    errors.push("Estructura de datos incompleta según el protocolo GEMINI.md.");
    return { isValid: false, errors: errors };
  }

  // Client Validation
  if (!payload.client.fullName || !payload.client.email || !payload.client.phone) {
    errors.push("Datos del cliente incompletos (nombre, email y teléfono requeridos).");
  }

  // Vehicle Validation
  const allowedCategories = ["sedan_hatchback", "suv_mediana", "pickup_suv_grande"];
  if (!allowedCategories.includes(payload.vehicle.category)) {
    errors.push("Categoría de vehículo inválida. Solo se admiten Sedán/Hatchback, SUV Mediana o Pick-up/SUV Grande.");
  }

  // Geo Whitelist
  if (!CONFIG.GEO_WHITELIST.includes(payload.location.city)) {
    errors.push(`Ubicación fuera de cobertura. Cobertura disponible estrictamente en: ${CONFIG.GEO_WHITELIST.join(", ")}.`);
  }
  if (!payload.location.address || payload.location.address.trim() === "") {
    errors.push("Dirección exacta requerida.");
  }

  // Date & Sunday Check
  if (!payload.schedule.date || !payload.schedule.time) {
    errors.push("Fecha y hora de cita requeridas.");
  } else {
    const parts = payload.schedule.date.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);

    if (dateObj.getDay() === 0) {
      errors.push("Servicio cerrado los días domingos.");
    }

    // Time Window (08:00 to 18:00)
    const timeParts = payload.schedule.time.split(":");
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);

    if (hour < CONFIG.WORK_START_HOUR || hour >= CONFIG.WORK_END_HOUR) {
      errors.push("El horario de inicio debe encontrarse dentro de la jornada laboral (08:00 a 18:00).");
    }

    // Total Duration Check
    const totalMinutes = (payload.services || []).reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const endMinutes = hour * 60 + minute + totalMinutes;
    if (endMinutes > CONFIG.WORK_END_HOUR * 60) {
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      errors.push(`La duración del servicio finaliza a las ${endH}:${endM < 10 ? '0' : ''}${endM}, excediendo el límite de cierre de las 18:00.`);
    }
  }

  return { isValid: errors.length === 0, errors: errors };
}

/**
 * Persist to Google Sheets
 */
function appendToSheet(bookingId, payload, totalMinutes, startDateTime, endDateTime, calendarEventId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create("GoDetailing_Reservas_DB");
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      "Booking ID", "Timestamp Creación", "Cliente", "Teléfono", "Email", 
      "Ciudad", "Dirección", "Categoría Vehículo", "Marca/Modelo/Año", "Placa",
      "Servicios", "Duración (Min)", "Total Gs.", "Inicio Agendado", "Fin Agendado", 
      "Estado", "Calendar Event ID"
    ]);
    sheet.getRange(1, 1, 1, 17).setFontWeight("bold").setBackground("#F3F4F6");
  }

  const serviceNames = payload.services.map(s => s.name).join(", ");
  const vehicleDesc = `${payload.vehicle.brand || ""} ${payload.vehicle.model || ""} (${payload.vehicle.year || ""})`.trim();

  sheet.appendRow([
    bookingId,
    new Date(),
    payload.client.fullName,
    payload.client.phone,
    payload.client.email,
    payload.location.city,
    payload.location.address,
    payload.vehicle.category,
    vehicleDesc,
    payload.vehicle.plate || "N/A",
    serviceNames,
    totalMinutes,
    payload.pricing.totalPriceGs,
    startDateTime,
    endDateTime,
    "CONFIRMADA",
    calendarEventId
  ]);

  return sheet.getLastRow();
}

/**
 * Helper: Parse Date & Time string to Date Object
 */
function parseDateTime(dateStr, timeStr) {
  const dateParts = dateStr.split("-");
  const timeParts = timeStr.split(":");
  return new Date(
    parseInt(dateParts[0], 10),
    parseInt(dateParts[1], 10) - 1,
    parseInt(dateParts[2], 10),
    parseInt(timeParts[0], 10),
    parseInt(timeParts[1], 10),
    0
  );
}

/**
 * Helper: JSON Response Builder with CORS
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
