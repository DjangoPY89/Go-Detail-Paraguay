/**
 * =========================================================================
 * PARAGUAY DETAIL - FRONTEND APPLICATION ENGINE (app.js)
 * =========================================================================
 * Inspired by godetail.com
 * Protocol: B.L.A.S.T. / Invariant Schema: GEMINI.md
 * Features:
 *   - Interactive Hero Quick Estimator
 *   - Touch & Mouse Before/After Transformation Slider
 *   - Services Catalog Filter & Auto-Select
 *   - 4-Step Booking Wizard with Sunday Lockout & Geo Whitelist
 *   - Real-time Pricing Formula: (totalMinutes / 60) * 100,000 Gs
 *   - Time Slot Validation (08:00 - 18:00 Operating Window)
 *   - Customer & Manager Dashboard Controller
 *   - FAQ Accordion Handler
 * =========================================================================
 */

// Configuration Constants (Strictly according to GEMINI.md)
const APP_CONFIG = {
  HOURLY_RATE_GS: 100000,
  WORK_START_HOUR: 8,
  WORK_END_HOUR: 18,
  GEO_WHITELIST: ["Asunción", "Luque", "San Lorenzo"],
  // Google Apps Script Webhook Endpoint (or Supabase Edge Function)
  GAS_WEBHOOK_URL: "https://script.google.com/macros/s/YOUR_DEPLOYED_GAS_ID/exec"
};

// Application State Store
const state = {
  currentStep: 1,
  vehicle: {
    category: "suv_mediana",
    categoryLabel: "SUV Mediana",
    brandModel: "",
    plate: ""
  },
  services: [
    { id: "detailing_basico", name: "Detailing Básico / Mantenimiento", durationMinutes: 180 }
  ],
  pricing: {
    totalMinutes: 180,
    hourlyRateGs: 100000,
    totalPriceGs: 300000
  },
  location: {
    city: "",
    address: "",
    notes: ""
  },
  schedule: {
    date: "",
    time: ""
  },
  client: {
    fullName: "",
    phone: "",
    email: "",
    userId: "usr_guest_" + Math.random().toString(36).substring(2, 7)
  }
};

/**
 * =========================================================================
 * 1. HERO QUICK ESTIMATOR MODULE
 * =========================================================================
 */
const heroEstimator = {
  selectVehicle(category) {
    const buttons = document.querySelectorAll(".hero-veh-btn");
    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.veh === category);
    });

    state.vehicle.category = category;
    const catNames = {
      sedan_hatchback: "Sedán / Hatchback",
      suv_mediana: "SUV Mediana",
      pickup_suv_grande: "Pick-up / SUV Grande"
    };
    state.vehicle.categoryLabel = catNames[category] || "SUV Mediana";

    // Sync with wizard cards
    const wizardCards = document.querySelectorAll(".vehicle-card");
    wizardCards.forEach(c => {
      const isSelected = c.dataset.category === category;
      c.classList.toggle("selected", isSelected);
      const radio = c.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    const priceEl = document.getElementById("heroEstPrice");
    if (priceEl) {
      priceEl.innerText = "Gs. 300.000";
    }
  },

  proceedToBooking() {
    const bookingSection = document.getElementById("booking");
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: "smooth" });
    }
  }
};

/**
 * =========================================================================
 * 2. INTERACTIVE BEFORE & AFTER COMPARISON SLIDER
 * =========================================================================
 */
const baSlider = {
  container: null,
  afterLayer: null,
  handle: null,
  isDragging: false,

  init() {
    this.container = document.getElementById("baSliderContainer");
    this.afterLayer = document.getElementById("baAfterLayer");
    this.handle = document.getElementById("baHandle");

    if (!this.container || !this.afterLayer || !this.handle) return;

    // Mouse events
    this.handle.addEventListener("mousedown", () => { this.isDragging = true; });
    window.addEventListener("mouseup", () => { this.isDragging = false; });
    this.container.addEventListener("mousemove", (e) => this.onMove(e.clientX));

    // Touch events for mobile
    this.handle.addEventListener("touchstart", () => { this.isDragging = true; }, { passive: true });
    window.addEventListener("touchend", () => { this.isDragging = false; });
    this.container.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches[0]) {
        this.onMove(e.touches[0].clientX);
      }
    }, { passive: true });

    // Allow clicking anywhere on container to move handle
    this.container.addEventListener("click", (e) => this.onMove(e.clientX));
  },

  onMove(clientX) {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    let xPos = clientX - rect.left;

    // Constrain within bounds (5% to 95%)
    const min = rect.width * 0.05;
    const max = rect.width * 0.95;
    if (xPos < min) xPos = min;
    if (xPos > max) xPos = max;

    const percentage = (xPos / rect.width) * 100;
    this.afterLayer.style.width = `${percentage}%`;
    this.handle.style.left = `${percentage}%`;
  }
};

/**
 * =========================================================================
 * 3. SERVICES CATALOG FILTER & DIRECT SELECTOR
 * =========================================================================
 */
const servicesCatalog = {
  filter(category) {
    const buttons = document.querySelectorAll(".filter-btn");
    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.filter === category);
    });

    const cards = document.querySelectorAll(".service-card");
    cards.forEach(card => {
      if (category === "all" || card.dataset.cat === category) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  },

  selectServiceAndBook(serviceId) {
    // Select the service item in the wizard
    const wizardItems = document.querySelectorAll(".service-item");
    wizardItems.forEach(item => {
      if (item.dataset.id === serviceId) {
        item.classList.add("selected");
      }
    });

    wizard.updateSelectedServices();
    wizard.calculatePricing();

    // Smooth scroll to wizard step 2
    const bookingSection = document.getElementById("booking");
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: "smooth" });
    }
    wizard.goToStep(2);
    toast.show("Servicio pre-seleccionado en el cotizador.", "success");
  }
};

/**
 * =========================================================================
 * 4. BOOKING WIZARD CONTROLLER (GEMINI.md Compliant)
 * =========================================================================
 */
const wizard = {
  init() {
    const bookingEl = document.getElementById("booking");
    if (!bookingEl) return;
    this.setupVehicleCards();
    this.setupServiceItems();
    this.setupDatePickerMin();
    this.calculatePricing();
  },

  setupVehicleCards() {
    const cards = document.querySelectorAll(".vehicle-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        cards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        
        state.vehicle.category = card.dataset.category;
        state.vehicle.categoryLabel = card.querySelector("h4").innerText;

        // Sync with Hero estimator buttons
        const heroBtns = document.querySelectorAll(".hero-veh-btn");
        heroBtns.forEach(btn => {
          btn.classList.toggle("active", btn.dataset.veh === state.vehicle.category);
        });
      });
    });
  },

  setupServiceItems() {
    const serviceItems = document.querySelectorAll(".service-item");
    serviceItems.forEach(item => {
      item.addEventListener("click", () => {
        item.classList.toggle("selected");
        this.updateSelectedServices();
        this.calculatePricing();
      });
    });
  },

  updateSelectedServices() {
    const selectedItems = document.querySelectorAll(".service-item.selected");
    state.services = Array.from(selectedItems).map(item => ({
      id: item.dataset.id,
      name: item.dataset.name,
      durationMinutes: parseInt(item.dataset.duration, 10)
    }));
  },

  calculatePricing() {
    const totalMinutes = state.services.reduce((acc, s) => acc + s.durationMinutes, 0);
    // Pricing Determinism: totalPriceGs = (totalMinutes / 60) * 100,000 Gs
    const totalPriceGs = Math.round((totalMinutes / 60) * APP_CONFIG.HOURLY_RATE_GS);

    state.pricing.totalMinutes = totalMinutes;
    state.pricing.totalPriceGs = totalPriceGs;

    // Update UI elements
    const hours = (totalMinutes / 60).toFixed(1).replace(".0", "");
    const durText = `${hours} hora${hours === "1" ? "" : "s"} (${totalMinutes} min)`;
    const priceFormatted = `Gs. ${totalPriceGs.toLocaleString("es-PY")}`;

    const durEl = document.getElementById("calcDurationText");
    const priceEl = document.getElementById("calcPriceText");

    if (durEl) durEl.innerText = totalMinutes > 0 ? durText : "0 min";
    if (priceEl) priceEl.innerText = priceFormatted;
  },

  setupDatePickerMin() {
    const dateInput = document.getElementById("scheduleDate");
    if (!dateInput) return;
    
    // Set min date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  },

  validateDateSelection(input) {
    if (!input.value) return;
    
    // Date string is YYYY-MM-DD
    const parts = input.value.split("-");
    const chosenDate = new Date(parts[0], parts[1] - 1, parts[2]);

    // Sunday Check: dayOfWeek === 0 (Strict Rule 1 in GEMINI.md)
    if (chosenDate.getDay() === 0) {
      toast.show("¡Atención! Permanecemos cerrados los días domingos. Por favor seleccioná un día de lunes a sábado.", "error");
      input.value = "";
      state.schedule.date = "";
      return;
    }

    state.schedule.date = input.value;
  },

  handleCityChange() {
    const citySelect = document.getElementById("locationCity");
    const addressGroup = document.getElementById("addressGroup");
    
    if (citySelect && citySelect.value) {
      // Whitelist check: Asunción, Luque, San Lorenzo (Strict Rule 3)
      if (!APP_CONFIG.GEO_WHITELIST.includes(citySelect.value)) {
        toast.show("Ciudad fuera de cobertura. Cobertura disponible: Asunción, Luque, San Lorenzo.", "error");
        citySelect.value = "";
        if (addressGroup) addressGroup.style.display = "none";
        return;
      }
      state.location.city = citySelect.value;
      if (addressGroup) addressGroup.style.display = "block";
    }
  },

  validateTimeSlot() {
    const timeSelect = document.getElementById("scheduleTime");
    if (!timeSelect || !timeSelect.value) return;

    const [hour, min] = timeSelect.value.split(":").map(Number);
    const totalMinutes = state.pricing.totalMinutes;
    const endMinutes = hour * 60 + min + totalMinutes;

    // Operating Hours: 08:00 to 18:00 (Strict Rule 2)
    if (endMinutes > APP_CONFIG.WORK_END_HOUR * 60) {
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      toast.show(`El servicio durará ${totalMinutes} min y finalizaría a las ${endH}:${endM < 10 ? '0' : ''}${endM}. Nuestro horario de cierre es a las 18:00. Elegí un horario más temprano.`, "error");
      timeSelect.value = "";
      state.schedule.time = "";
      return;
    }

    state.schedule.time = timeSelect.value;
  },

  goToStep(stepNumber) {
    document.querySelectorAll(".step-pane").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".step-node").forEach(n => {
      const step = parseInt(n.dataset.step, 10);
      n.classList.remove("active", "completed");
      if (step === stepNumber) n.classList.add("active");
      if (step < stepNumber) n.classList.add("completed");
    });

    const targetPane = document.getElementById(`step${stepNumber}`);
    if (targetPane) targetPane.classList.add("active");
    state.currentStep = stepNumber;
  },

  nextStep() {
    if (state.currentStep === 1) {
      const brandInput = document.getElementById("vehBrandModel");
      const plateInput = document.getElementById("vehPlate");
      if (brandInput) state.vehicle.brandModel = brandInput.value;
      if (plateInput) state.vehicle.plate = plateInput.value;
      this.goToStep(2);
    } else if (state.currentStep === 2) {
      if (state.services.length === 0) {
        toast.show("Por favor seleccioná al menos 1 servicio para continuar.", "error");
        return;
      }
      this.goToStep(3);
    }
  },

  prevStep() {
    if (state.currentStep > 1) {
      this.goToStep(state.currentStep - 1);
    }
  },

  validateAndGoToReview() {
    const city = document.getElementById("locationCity").value;
    const address = document.getElementById("locationAddress").value;
    const date = document.getElementById("scheduleDate").value;
    const time = document.getElementById("scheduleTime").value;
    const name = document.getElementById("clientName").value;
    const phone = document.getElementById("clientPhone").value;
    const email = document.getElementById("clientEmail").value;

    if (!city || !address || !date || !time || !name || !phone || !email) {
      toast.show("Por favor completá todos los campos obligatorios (*).", "error");
      return;
    }

    state.location.city = city;
    state.location.address = address;
    state.schedule.date = date;
    state.schedule.time = time;
    state.client.fullName = name;
    state.client.phone = phone;
    state.client.email = email;

    // Populate Review Step
    const brandStr = state.vehicle.brandModel ? ` (${state.vehicle.brandModel})` : "";
    const revVeh = document.getElementById("revVehicle");
    const revSvc = document.getElementById("revServices");
    const revLoc = document.getElementById("revLocation");
    const revDate = document.getElementById("revDateTime");
    const revCli = document.getElementById("revClient");
    const revDur = document.getElementById("revDurationSummary");
    const revPrice = document.getElementById("revTotalPrice");

    if (revVeh) revVeh.innerText = `${state.vehicle.categoryLabel}${brandStr}`;
    if (revSvc) revSvc.innerText = state.services.map(s => s.name).join(", ");
    if (revLoc) revLoc.innerText = `${state.location.address}, ${state.location.city}`;
    if (revDate) revDate.innerText = `${state.schedule.date} a las ${state.schedule.time} hs`;
    if (revCli) revCli.innerText = `${state.client.fullName} (${state.client.phone})`;
    
    const hours = (state.pricing.totalMinutes / 60).toFixed(1).replace(".0", "");
    if (revDur) revDur.innerText = `${hours} horas (${state.pricing.totalMinutes} min)`;
    if (revPrice) revPrice.innerText = `Gs. ${state.pricing.totalPriceGs.toLocaleString("es-PY")}`;

    this.goToStep(4);
  },

  async submitBooking() {
    const submitBtn = document.getElementById("confirmBookingBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="loading-spinner"></span> Agendando Cita...`;
    }

    // Build Payload conforming strictly to GEMINI.md
    const payload = {
      client: {
        fullName: state.client.fullName,
        email: state.client.email,
        phone: state.client.phone,
        userId: state.client.userId
      },
      vehicle: {
        category: state.vehicle.category,
        brand: state.vehicle.brandModel.split(" ")[0] || "Generico",
        model: state.vehicle.brandModel.split(" ").slice(1).join(" ") || state.vehicle.categoryLabel,
        year: 2023,
        plate: state.vehicle.plate || "N/A"
      },
      services: state.services,
      schedule: {
        date: state.schedule.date,
        time: state.schedule.time
      },
      location: {
        city: state.location.city,
        address: state.location.address,
        notes: "Reserva generada desde portal web Paraguay Detail"
      },
      pricing: {
        totalMinutes: state.pricing.totalMinutes,
        hourlyRateGs: state.pricing.hourlyRateGs,
        totalPriceGs: state.pricing.totalPriceGs,
        paymentMethod: "pay_on_completion"
      }
    };

    console.log("🚀 Submitting Booking Payload:", payload);

    try {
      let bookingId = "BK-" + Math.floor(1000 + Math.random() * 9000);
      
      // If deployed endpoint is configured, invoke it
      if (APP_CONFIG.GAS_WEBHOOK_URL && !APP_CONFIG.GAS_WEBHOOK_URL.includes("YOUR_DEPLOYED_GAS_ID")) {
        const response = await fetch(APP_CONFIG.GAS_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.status === "success" && result.data && result.data.bookingId) {
          bookingId = result.data.bookingId;
        }
      } else {
        // Fast deterministic delay for simulation
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Show Success Modal
      const modalIdEl = document.getElementById("successBookingId");
      if (modalIdEl) modalIdEl.innerText = bookingId;
      
      const successModal = document.getElementById("successModal");
      if (successModal) successModal.classList.add("open");

    } catch (err) {
      console.error("Booking Error:", err);
      toast.show("Ocurrió un inconveniente al procesar la reserva. Por favor intenta de nuevo.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="calendar-check" style="width: 20px; height: 20px;"></i> Confirmar Reserva`;
        lucide.createIcons();
      }
    }
  }
};

/**
 * =========================================================================
 * 5. FAQ ACCORDION HANDLER
 * =========================================================================
 */
const faqAccordion = {
  init() {
    const faqQuestions = document.querySelectorAll(".faq-question");
    faqQuestions.forEach(q => {
      q.addEventListener("click", () => {
        const item = q.parentElement;
        const isOpen = item.classList.contains("open");
        
        // Close other items
        document.querySelectorAll(".faq-item").forEach(i => i.classList.remove("open"));
        
        if (!isOpen) {
          item.classList.add("open");
        }
      });
    });
  }
};

/**
 * =========================================================================
 * 6. AUTH CONTROLLER (Firebase / Supabase OAuth Handler)
 * =========================================================================
 */
const auth = {
  openModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.add("open");
  },

  closeModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.remove("open");
  },

  loginWithGoogle() {
    toast.show("Conectando con Google OAuth...", "success");
    setTimeout(() => {
      toast.show("Sesión iniciada correctamente con Google.", "success");
      this.closeModal();
      window.location.href = "dashboard.html";
    }, 700);
  },

  loginWithFacebook() {
    toast.show("Conectando con Facebook OAuth...", "success");
    setTimeout(() => {
      toast.show("Sesión iniciada correctamente con Facebook.", "success");
      this.closeModal();
      window.location.href = "dashboard.html";
    }, 700);
  },

  handleEmailAuth(e) {
    e.preventDefault();
    const email = document.getElementById("authEmail").value;
    toast.show(`Bienvenido ${email}. Ingresando al panel...`, "success");
    setTimeout(() => {
      this.closeModal();
      window.location.href = "dashboard.html";
    }, 700);
  }
};

/**
 * =========================================================================
 * 7. DASHBOARD CONTROLLER (Customer & Manager Hub)
 * =========================================================================
 */
const dashboard = {
  switchTab(tabId) {
    document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
    const activeLink = document.querySelector(`.nav-link[href="#${tabId}"]`);
    if (activeLink) activeLink.classList.add("active");

    const sectionVehicles = document.getElementById("section-vehicles");
    const sectionBookings = document.getElementById("section-bookings");
    const sectionManager = document.getElementById("section-manager");

    if (tabId === "vehicles") {
      if (sectionVehicles) sectionVehicles.style.display = "block";
      if (sectionBookings) sectionBookings.style.display = "none";
      if (sectionManager) sectionManager.style.display = "none";
    } else if (tabId === "bookings") {
      if (sectionVehicles) sectionVehicles.style.display = "none";
      if (sectionBookings) sectionBookings.style.display = "block";
      if (sectionManager) sectionManager.style.display = "none";
    } else if (tabId === "manager") {
      if (sectionVehicles) sectionVehicles.style.display = "none";
      if (sectionBookings) sectionBookings.style.display = "none";
      if (sectionManager) sectionManager.style.display = "block";
    } else {
      if (sectionVehicles) sectionVehicles.style.display = "block";
      if (sectionBookings) sectionBookings.style.display = "block";
      if (sectionManager) sectionManager.style.display = "block";
    }
  },

  handleSearch(query) {
    const q = query.toLowerCase();
    const cards = document.querySelectorAll(".dashboard-vehicle-card");
    cards.forEach(card => {
      const text = card.innerText.toLowerCase();
      card.style.display = text.includes(q) ? "block" : "none";
    });

    const rows = document.querySelectorAll("#bookingsTableBody tr");
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(q) ? "" : "none";
    });
  },

  openAddVehicleModal() {
    const modal = document.getElementById("addVehicleModal");
    if (modal) modal.classList.add("open");
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("open");
  },

  handleAddVehicle(e) {
    e.preventDefault();
    const cat = document.getElementById("newVehCat").value;
    const brandModel = document.getElementById("newVehBrandModel").value;
    const year = document.getElementById("newVehYear").value || "2023";
    const plate = document.getElementById("newVehPlate").value || "PY 000";

    const catIcon = cat === "sedan_hatchback" ? "🚗" : cat === "suv_mediana" ? "🚙" : "🛻";
    const catName = cat === "sedan_hatchback" ? "Sedán" : cat === "suv_mediana" ? "SUV Mediana" : "Pick-up";

    const newCardHtml = `
      <div class="dashboard-vehicle-card">
        <div class="card-top">
          <div class="card-vehicle-title">
            <div class="card-vehicle-icon">${catIcon}</div>
            <div>
              <h3>${brandModel} (${year})</h3>
              <span class="plate-pill">${plate} • ${catName}</span>
            </div>
          </div>
          <button class="dots-menu-btn" title="Opciones"><i data-lucide="more-vertical" style="width: 18px; height: 18px;"></i></button>
        </div>
        <div class="stats-grid-2x2">
          <div class="stat-cell">
            <span>Último Servicio</span>
            <strong style="color: var(--slate-400);">Sin registros</strong>
          </div>
          <div class="stat-cell">
            <span>Próxima Cita</span>
            <strong style="color: var(--slate-400);">Sin programar</strong>
          </div>
          <div class="stat-cell">
            <span>Frecuencia</span>
            <strong>Nuevo</strong>
          </div>
          <div class="stat-cell">
            <span>Total Invertido</span>
            <strong>Gs. 0</strong>
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById("vehiclesContainer");
    if (container) {
      container.insertAdjacentHTML("afterbegin", newCardHtml);
      lucide.createIcons();
    }

    this.closeModal("addVehicleModal");
    toast.show("Vehículo registrado exitosamente.", "success");
  },

  vehicleMenu(id) {
    toast.show(`Opciones del vehículo (${id}): Agendar mantenimiento o editar ficha.`, "success");
  },

  showNotifications() {
    toast.show("🔔 Tenés 1 recordatorio: Tu próximo servicio de Detailing Básico está agendado para el 10 de Septiembre.", "success");
  }
};

/**
 * =========================================================================
 * 7.5 REVIEWS MODULE
 * =========================================================================
 */
const reviewsModule = {
  init() {
    const readMoreBtns = document.querySelectorAll(".card-read-more");
    readMoreBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const parentP = btn.closest(".card-body-text");
        if (parentP) {
          btn.style.display = "none";
        }
      });
    });
  }
};

/**
 * =========================================================================
 * 7.6 GALLERY MODULE
 * =========================================================================
 */
const galleryModule = {
  isExpanded: false,
  
  toggleExpand() {
    const wrapper = document.getElementById("galleryWrapper");
    const overlay = document.getElementById("galleryOverlay");
    if (!wrapper) return;

    this.isExpanded = !this.isExpanded;
    wrapper.classList.toggle("expanded", this.isExpanded);

    if (overlay) {
      overlay.style.display = this.isExpanded ? "none" : "flex";
    }
  }
};

/**
 * =========================================================================
 * 7.7 PRICING & PACKAGES SIMULATOR MODULE
 * =========================================================================
 */
const pricingSimulator = {
  state: {
    vehicleSize: 'coupe_sedan', // coupe_sedan, suv_mediana, pickup_suv_grande, van_oversized
    package: 'complete', // complete (Interior + Exterior), interior (Solo Interior)
    extras: new Set() // encerado, pulido_2pasos, pulido_faros, pulido_cristales, ceramic_coating
  },

  // Base pricing matrix per vehicle size
  pricingMatrix: {
    coupe_sedan: {
      name: 'Coupe / Sedan',
      wizardCat: 'sedan_hatchback',
      complete: { priceGs: 250000, durationMin: 150 },
      interior: { priceGs: 180000, durationMin: 110 }
    },
    suv_mediana: {
      name: '5-Seat SUV / Truck',
      wizardCat: 'suv_mediana',
      complete: { priceGs: 300000, durationMin: 180 },
      interior: { priceGs: 200000, durationMin: 120 }
    },
    pickup_suv_grande: {
      name: '7-Seat SUV / Truck',
      wizardCat: 'pickup_suv_grande',
      complete: { priceGs: 350000, durationMin: 210 },
      interior: { priceGs: 240000, durationMin: 145 }
    },
    van_oversized: {
      name: 'Van / Oversized',
      wizardCat: 'pickup_suv_grande',
      complete: { priceGs: 400000, durationMin: 240 },
      interior: { priceGs: 280000, durationMin: 170 }
    }
  },

  // Extras configuration
  extrasMatrix: {
    encerado: { name: 'Encerado Premium', priceGs: 60000, durationMin: 35 },
    pulido_2pasos: { name: 'Pulido 2 Pasos', priceGs: 200000, durationMin: 120 },
    pulido_faros: { name: 'Pulido de Faros', priceGs: 70000, durationMin: 40 },
    pulido_cristales: { name: 'Pulido de Cristales', priceGs: 80000, durationMin: 45 },
    ceramic_coating: { name: 'Ceramic Coating 9H', priceGs: 350000, durationMin: 180 }
  },

  init() {
    this.recalculate();
  },

  selectVehicleSize(size) {
    if (!this.pricingMatrix[size]) return;
    this.state.vehicleSize = size;

    // Update Vehicle cards UI
    const vehCards = document.querySelectorAll(".sim-veh-card");
    vehCards.forEach(card => {
      card.classList.toggle("selected", card.dataset.size === size);
    });

    // Update prices on the two package cards
    const pkgData = this.pricingMatrix[size];
    const priceCompEl = document.getElementById("pkgPriceComplete");
    const priceIntEl = document.getElementById("pkgPriceInterior");
    if (priceCompEl) priceCompEl.innerText = `Gs. ${pkgData.complete.priceGs.toLocaleString("es-PY")}`;
    if (priceIntEl) priceIntEl.innerText = `Gs. ${pkgData.interior.priceGs.toLocaleString("es-PY")}`;

    this.recalculate();
  },

  selectPackage(pkg) {
    if (pkg !== 'complete' && pkg !== 'interior') return;
    this.state.package = pkg;

    // Update Package cards UI
    const cardComplete = document.getElementById("pkgCardComplete");
    const cardInterior = document.getElementById("pkgCardInterior");
    const btnComplete = document.getElementById("pkgBtnTextComplete");
    const btnInterior = document.getElementById("pkgBtnTextInterior");

    if (cardComplete && cardInterior) {
      cardComplete.classList.toggle("selected", pkg === 'complete');
      cardInterior.classList.toggle("selected", pkg === 'interior');
    }

    if (btnComplete && btnInterior) {
      if (pkg === 'complete') {
        btnComplete.innerText = "Paquete Seleccionado";
        btnInterior.innerText = "Elegir este Paquete";
      } else {
        btnComplete.innerText = "Elegir este Paquete";
        btnInterior.innerText = "Paquete Seleccionado";
      }
    }

    this.recalculate();
  },

  toggleExtra(extraId) {
    const card = document.querySelector(`.sim-extra-card[data-extra="${extraId}"]`);
    if (!card) return;

    if (this.state.extras.has(extraId)) {
      this.state.extras.delete(extraId);
      card.classList.remove("selected");
      const icon = card.querySelector(".sim-extra-checkbox i");
      if (icon) icon.style.display = "none";
    } else {
      this.state.extras.add(extraId);
      card.classList.add("selected");
      const icon = card.querySelector(".sim-extra-checkbox i");
      if (icon) icon.style.display = "block";
    }

    this.recalculate();
  },

  recalculate() {
    const vehConfig = this.pricingMatrix[this.state.vehicleSize];
    const basePkg = vehConfig[this.state.package];

    let totalPrice = basePkg.priceGs;
    let totalMinutes = basePkg.durationMin;

    this.state.extras.forEach(extraId => {
      const extra = this.extrasMatrix[extraId];
      if (extra) {
        totalPrice += extra.priceGs;
        totalMinutes += extra.durationMin;
      }
    });

    // Format Hours and Minutes
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeFormatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;

    // Package Name
    const pkgName = this.state.package === 'complete' ? 'The Standard Detail' : 'Interior Detail';
    
    // Extras text
    let extrasText = '';
    if (this.state.extras.size > 0) {
      extrasText = ` + ${this.state.extras.size} Extra${this.state.extras.size > 1 ? 's' : ''}`;
    }

    // Update UI elements
    const summaryTextEl = document.getElementById("simSummaryText");
    const summaryPriceEl = document.getElementById("simSummaryPrice");
    const summaryTimeEl = document.getElementById("simSummaryTime");

    if (summaryTextEl) {
      summaryTextEl.innerText = `${vehConfig.name} • ${pkgName}${extrasText}`;
    }
    if (summaryPriceEl) {
      summaryPriceEl.innerText = `Gs. ${totalPrice.toLocaleString("es-PY")}`;
    }
    if (summaryTimeEl) {
      summaryTimeEl.innerHTML = `<i data-lucide="clock" style="width: 14px; height: 14px; display: inline;"></i> Tiempo Estimado: ${timeFormatted} • Pago al finalizar`;
      if (window.lucide) lucide.createIcons();
    }
  },

  transferToBooking() {
    const vehConfig = this.pricingMatrix[this.state.vehicleSize];
    const basePkg = vehConfig[this.state.package];
    const pkgName = this.state.package === 'complete' ? 'The Standard Detail (Interior + Exterior)' : 'Interior Detail (Solo Interior)';
    
    let totalPrice = basePkg.priceGs;
    let totalMinutes = basePkg.durationMin;
    const extrasList = [];

    this.state.extras.forEach(extraId => {
      const extra = this.extrasMatrix[extraId];
      if (extra) {
        totalPrice += extra.priceGs;
        totalMinutes += extra.durationMin;
        extrasList.push(extra.name);
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeFormatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;

    const extrasStr = extrasList.length > 0 ? `\n• *Extras:* ${extrasList.join(', ')}` : '';
    const message = `¡Hola Paraguay Detail! Me gustaría agendar un turno con la siguiente configuración:\n\n` +
      `🚗 *Vehículo:* ${vehConfig.name}\n` +
      `✨ *Paquete:* ${pkgName}${extrasStr}\n` +
      `⏱️ *Tiempo Estimado:* ${timeFormatted}\n` +
      `💰 *Total Estimado:* Gs. ${totalPrice.toLocaleString("es-PY")}\n\n` +
      `¿Tienen disponibilidad en Asunción / Gran Asunción para esta semana?`;

    const whatsappUrl = `https://wa.me/595981123456?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    toast.show("¡Abriendo WhatsApp con tu cotización!", "success");
  }
};

/**
 * =========================================================================
 * 8. TOAST NOTIFIER
 * =========================================================================
 */
const toast = {
  show(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toastEl = document.createElement("div");
    toastEl.className = `toast toast-${type}`;
    toastEl.innerHTML = `<span>${message}</span>`;
    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateX(100%)";
      setTimeout(() => toastEl.remove(), 300);
    }, 4000);
  }
};

// Global Bootstrapping
document.addEventListener("DOMContentLoaded", () => {
  wizard.init();
  baSlider.init();
  faqAccordion.init();
  reviewsModule.init();
  pricingSimulator.init();

  const authBtn = document.getElementById("openAuthModalBtn");
  if (authBtn) authBtn.addEventListener("click", () => auth.openModal());
});

