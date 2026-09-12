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
    const collapseBar = document.getElementById("galleryCollapseBar");
    if (!wrapper) return;

    this.isExpanded = !this.isExpanded;
    wrapper.classList.toggle("expanded", this.isExpanded);

    if (overlay) {
      overlay.style.display = this.isExpanded ? "none" : "flex";
    }
    if (collapseBar) {
      collapseBar.style.display = this.isExpanded ? "flex" : "none";
    }

    if (!this.isExpanded) {
      const gallerySection = document.getElementById("gallery");
      if (gallerySection) {
        gallerySection.scrollIntoView({ behavior: "smooth" });
      }
    }

    if (window.lucide) lucide.createIcons();
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
      name: 'Coupé / Sedán',
      wizardCat: 'sedan_hatchback',
      complete: { priceGs: 250000, durationMin: 150 },
      interior: { priceGs: 180000, durationMin: 110 }
    },
    suv_mediana: {
      name: 'SUV Mediana (5 Asientos)',
      wizardCat: 'suv_mediana',
      complete: { priceGs: 300000, durationMin: 180 },
      interior: { priceGs: 200000, durationMin: 120 }
    },
    pickup_suv_grande: {
      name: 'SUV Grande / Pick-Up (7 Asientos)',
      wizardCat: 'pickup_suv_grande',
      complete: { priceGs: 350000, durationMin: 210 },
      interior: { priceGs: 240000, durationMin: 145 }
    },
    van_oversized: {
      name: 'Van / Furgón Grande',
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

  currentStage: 1,

  init() {
    const stage1 = document.getElementById("simStage1");
    if (!stage1) return;
    this.goToStage(1);
    this.recalculate();
  },

  goToStage(stageNum) {
    if (stageNum < 1 || stageNum > 4) return;
    this.currentStage = stageNum;

    // Update Stage Panels
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`simStage${i}`);
      if (panel) {
        panel.classList.toggle("active", i === stageNum);
      }
      const tab = document.getElementById(`simTab${i}`);
      if (tab) {
        tab.classList.toggle("active", i === stageNum);
        tab.classList.toggle("completed", i < stageNum);
      }
    }

    // Update Progress Bar
    const progressBar = document.getElementById("simProgressBar");
    if (progressBar) {
      const percent = ((stageNum - 1) / 3) * 100;
      progressBar.style.width = `${Math.max(12, percent)}%`;
    }

    // Update Nav Buttons
    const prevBtn = document.getElementById("simPrevBtn");
    const nextBtn = document.getElementById("simNextBtn");
    const nextBtnText = document.getElementById("simNextBtnText");

    if (prevBtn) {
      prevBtn.style.visibility = stageNum === 1 ? "hidden" : "visible";
    }

    if (nextBtn && nextBtnText) {
      if (stageNum === 1) {
        nextBtnText.innerText = "Continuar a Paquetes";
      } else if (stageNum === 2) {
        nextBtnText.innerText = "Continuar a Extras";
      } else if (stageNum === 3) {
        nextBtnText.innerText = "Ver Resumen Final";
      } else if (stageNum === 4) {
        nextBtnText.innerText = "Agendar Turno";
      }
    }

    if (stageNum === 4) {
      this.renderSummaryStage();
    }

    if (window.lucide) lucide.createIcons();
  },

  nextStage() {
    if (this.currentStage < 4) {
      this.goToStage(this.currentStage + 1);
    } else {
      this.transferToBooking();
    }
  },

  prevStage() {
    if (this.currentStage > 1) {
      this.goToStage(this.currentStage - 1);
    }
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

  renderSummaryStage() {
    const vehConfig = this.pricingMatrix[this.state.vehicleSize];
    const basePkg = vehConfig[this.state.package];
    const pkgName = this.state.package === 'complete' ? 'Detallado Estándar (Completo)' : 'Detallado de Interiores (Solo Interior)';

    let totalPrice = basePkg.priceGs;
    let totalMinutes = basePkg.durationMin;
    const extrasList = [];

    this.state.extras.forEach(extraId => {
      const extra = this.extrasMatrix[extraId];
      if (extra) {
        totalPrice += extra.priceGs;
        totalMinutes += extra.durationMin;
        extrasList.push({ name: extra.name, price: extra.priceGs, time: extra.durationMin });
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeFormatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;

    const summaryVehEl = document.getElementById("stage4Vehicle");
    const summaryPkgEl = document.getElementById("stage4Package");
    const summaryPkgPriceEl = document.getElementById("stage4PkgPrice");
    const summaryExtrasListEl = document.getElementById("stage4ExtrasList");
    const summaryTotalTimeEl = document.getElementById("stage4TotalTime");
    const summaryTotalPriceEl = document.getElementById("stage4TotalPrice");

    if (summaryVehEl) summaryVehEl.innerText = vehConfig.name;
    if (summaryPkgEl) summaryPkgEl.innerText = pkgName;
    if (summaryPkgPriceEl) summaryPkgPriceEl.innerText = `Gs. ${basePkg.priceGs.toLocaleString("es-PY")}`;

    if (summaryExtrasListEl) {
      if (extrasList.length === 0) {
        summaryExtrasListEl.innerHTML = `<li class="no-extras"><i data-lucide="check-circle-2" style="width: 14px; height: 14px; color: #10b981;"></i> Sin extras adicionales seleccionados</li>`;
      } else {
        summaryExtrasListEl.innerHTML = extrasList.map(e => `
          <li>
            <span><i data-lucide="plus-circle" style="width: 14px; height: 14px; color: #0066FF;"></i> ${e.name} (+${e.time} min)</span>
            <strong>+Gs. ${e.price.toLocaleString("es-PY")}</strong>
          </li>
        `).join("");
      }
    }

    if (summaryTotalTimeEl) summaryTotalTimeEl.innerText = timeFormatted;
    if (summaryTotalPriceEl) summaryTotalPriceEl.innerText = `Gs. ${totalPrice.toLocaleString("es-PY")}`;
    if (window.lucide) lucide.createIcons();
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
    const pkgName = this.state.package === 'complete' ? 'Detallado Estándar (Completo)' : 'Detallado de Interiores (Solo Interior)';
    
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

    if (this.currentStage === 4) {
      this.renderSummaryStage();
    }
  },

  transferToBooking() {
    const vehConfig = this.pricingMatrix[this.state.vehicleSize];
    const basePkg = vehConfig[this.state.package];
    const pkgName = this.state.package === 'complete' ? 'Detallado Estándar (Interior + Exterior)' : 'Detallado de Interiores (Solo Interior)';
    
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
 * 10. GODETAIL 5-STEP BOOKING WIZARD CONTROLLER (Suds / GoDetail UX)
 * =========================================================================
 */
const gdWizard = {
  state: {
    currentStep: 1, // 1, 2, '3A', '3B', 4, 5
    service: {
      id: 'full_detail',
      name: 'Full Detail',
      durationMinutes: 210,
      priceGs: 300000
    },
    location: {
      type: 'location', // 'location' or 'shop'
      address: 'Av. Santa Teresa 1827',
      city: 'Asunción'
    },
    vehicle: {
      year: '2024',
      make: 'Toyota',
      model: 'Tacoma / Hilux',
      size: 'suv_truck',
      sizeLabel: 'SUV / Truck',
      img: 'assets/suv-7seat-vector.png'
    },
    tier: {
      id: 'gold',
      name: 'Gold Premium',
      durationMinutes: 210,
      priceGs: 350000
    },
    schedule: {
      date: '2026-09-15',
      dateFormatted: 'Martes, 15 de Septiembre',
      time: '08:30',
      timeFormatted: '8:30 AM'
    },
    client: {
      fullName: '',
      phone: '',
      email: '',
      notes: ''
    },
    calMonth: 8, // September (0-indexed: 8 = Sep)
    calYear: 2026
  },

  modelsPerMake: {
    Toyota: ["Tacoma / Hilux", "Land Cruiser / Prado", "Corolla", "Camry", "RAV4", "SW4 / Fortuner"],
    BMW: ["Serie 3 (Sedán)", "Serie 5", "X3 (Crossover)", "X5 (SUV)", "X7 (XL SUV)", "M4 (Coupé)"],
    "Mercedes-Benz": ["Clase C", "Clase E", "GLC", "GLE", "GLS", "Sprinter"],
    Honda: ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Ridgeline"],
    Ford: ["Ranger", "F-150", "Explorer", "Mustang", "Transit", "Bronco"],
    Hyundai: ["Tucson", "Santa Fe", "Creta", "Elantra", "Palisade", "Staria"],
    Kia: ["Sportage", "Sorento", "Carnival", "Cerato", "Telluride", "K3"],
    Chevrolet: ["S10", "Tracker", "Trailblazer", "Silverado", "Camaro", "Cruze"],
    Porsche: ["911 Carrera", "Cayenne", "Macan", "Panamera", "Taycan"],
    Audi: ["A4", "A6", "Q3", "Q5", "Q7", "Q8"],
    Volkswagen: ["Amarok", "Golf", "Taos", "Tiguan", "T-Cross", "Touareg"],
    Jeep: ["Wrangler", "Grand Cherokee", "Compass", "Renegade", "Gladiator"],
    "Land Rover": ["Defender", "Range Rover Sport", "Range Rover Velar", "Discovery"]
  },

  vehicleImages: {
    coupe: "assets/toyota-camry.png",
    sedan: "assets/toyota-camry.png",
    crossover: "assets/mid-size-suv.png",
    suv_truck: "assets/suv-7seat-vector.png",
    xl_suv: "assets/land-cruiser.png",
    van_sprinter: "assets/van.png"
  },

  init() {
    const bookingContainer = document.getElementById("booking");
    if (!bookingContainer) return;

    this.renderCalendar();
    this.updateVehiclePreview();
    if (window.lucide) lucide.createIcons();
  },

  goToStep(step) {
    this.state.currentStep = step;

    // Hide all step panels
    const panels = ["gdStep1", "gdStep2", "gdStep3A", "gdStep3B", "gdStep4", "gdStep5"];
    panels.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("active");
    });

    // Show target step panel
    const targetId = step === '3A' ? 'gdStep3A' : step === '3B' ? 'gdStep3B' : `gdStep${step}`;
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.add("active");

    // Update Top Navigation
    const backBtn = document.getElementById("gdBackBtn");
    const stepText = document.getElementById("gdStepText");
    const progressBar = document.getElementById("gdProgressBar");

    if (backBtn) {
      backBtn.style.visibility = step === 1 ? "hidden" : "visible";
    }

    let label = "Service · 1/5";
    let progress = "20%";

    if (step === 2) {
      label = "Location · 2/5";
      progress = "40%";
    } else if (step === '3A' || step === '3B') {
      label = "Details · 3/5";
      progress = "60%";
    } else if (step === 4) {
      label = "Schedule · 4/5";
      progress = "80%";
    } else if (step === 5) {
      label = "Review · 5/5";
      progress = "100%";
    }

    if (stepText) stepText.innerText = label;
    if (progressBar) progressBar.style.width = progress;

    // Scroll smoothly to top of wizard container
    const section = document.getElementById("booking");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (window.lucide) lucide.createIcons();
  },

  prevStep() {
    const cur = this.state.currentStep;
    if (cur === 5) this.goToStep(4);
    else if (cur === 4) this.goToStep('3B');
    else if (cur === '3B') this.goToStep('3A');
    else if (cur === '3A') this.goToStep(2);
    else if (cur === 2) this.goToStep(1);
  },

  selectService(id, name, duration, price) {
    this.state.service = { id, name, durationMinutes: duration, priceGs: price };

    const locSvcName = document.getElementById("gdLocServiceName");
    const tierSvcName = document.getElementById("gdTierServiceName");

    if (locSvcName) locSvcName.innerText = name;
    if (tierSvcName) tierSvcName.innerText = name;

    this.goToStep(2);
  },

  selectLocationType(type) {
    this.state.location.type = type;

    const locCard = document.getElementById("locChoiceLocation");
    const shopCard = document.getElementById("locChoiceShop");
    const addrSection = document.getElementById("gdAddressSection");

    if (locCard && shopCard) {
      locCard.classList.toggle("active", type === 'location');
      shopCard.classList.toggle("active", type === 'shop');
    }

    const pinLabel = document.getElementById("gdPinLabel");
    if (pinLabel) {
      pinLabel.innerText = type === 'location' 
        ? `${this.state.location.city} (A Domicilio)` 
        : `Taller Oficial (${this.state.location.city})`;
    }
  },

  selectCity(city) {
    if (!APP_CONFIG.GEO_WHITELIST.includes(city)) {
      toast.show("Ciudad fuera de cobertura. Disponible: Asunción, Luque, San Lorenzo.", "error");
      return;
    }

    this.state.location.city = city;

    // Update chips
    const chips = {
      "Asunción": "chipAsuncion",
      "Luque": "chipLuque",
      "San Lorenzo": "chipSanLorenzo"
    };

    Object.keys(chips).forEach(c => {
      const el = document.getElementById(chips[c]);
      if (el) el.classList.toggle("active", c === city);
    });

    const pinLabel = document.getElementById("gdPinLabel");
    if (pinLabel) {
      pinLabel.innerText = `${city} (Cobertura Activa)`;
    }
  },

  mapZoom(delta) {
    const canvas = document.getElementById("gdMapCanvas");
    if (canvas) {
      const currentScale = parseFloat(canvas.dataset.scale || "1");
      const newScale = Math.min(Math.max(0.85, currentScale + delta * 0.15), 1.5);
      canvas.dataset.scale = newScale;
      const roads = canvas.querySelector(".gd-map-roads-svg");
      if (roads) roads.style.transform = `scale(${newScale})`;
    }
  },

  nextFromLocation() {
    const addrInput = document.getElementById("gdAddressInput");
    if (addrInput && addrInput.value.trim()) {
      this.state.location.address = addrInput.value.trim();
    }

    if (!this.state.location.address && this.state.location.type === 'location') {
      toast.show("Por favor ingresá tu dirección para continuar.", "error");
      return;
    }

    this.goToStep('3A');
  },

  handleMakeChange() {
    const makeSelect = document.getElementById("gdVehMake");
    const modelSelect = document.getElementById("gdVehModel");
    if (!makeSelect || !modelSelect) return;

    const selectedMake = makeSelect.value;
    const models = this.modelsPerMake[selectedMake] || ["Modelo Estándar", "Crossover / SUV", "Sedán"];

    modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join("");
    this.updateVehiclePreview();
  },

  selectVehicleSize(size) {
    this.state.vehicle.size = size;
    const sizeLabels = {
      coupe: "Coupe / 2-seater",
      sedan: "Sedan",
      crossover: "Crossover",
      suv_truck: "SUV / Truck",
      xl_suv: "XL SUV / Truck",
      van_sprinter: "Van / Sprinter"
    };
    this.state.vehicle.sizeLabel = sizeLabels[size] || "SUV / Truck";

    // Update active class on cards
    document.querySelectorAll(".gd-size-card").forEach(c => {
      const isSelected = c.dataset.size === size;
      c.classList.toggle("active", isSelected);
      
      // Update check icon
      let check = c.querySelector(".gd-card-check");
      if (isSelected && !check) {
        c.insertAdjacentHTML("afterbegin", `<div class="gd-card-check"><i data-lucide="check" style="width: 14px; height: 14px;"></i></div>`);
      } else if (!isSelected && check) {
        check.remove();
      }
    });

    this.updateVehiclePreview();
    if (window.lucide) lucide.createIcons();
  },

  updateVehiclePreview() {
    const yearEl = document.getElementById("gdVehYear");
    const makeEl = document.getElementById("gdVehMake");
    const modelEl = document.getElementById("gdVehModel");
    const mainImgEl = document.getElementById("gdVehMainImg");
    const mini1El = document.getElementById("gdMiniCarImg");
    const mini2El = document.getElementById("gdMiniCarImg2");

    if (yearEl) this.state.vehicle.year = yearEl.value;
    if (makeEl) this.state.vehicle.make = makeEl.value;
    if (modelEl) this.state.vehicle.model = modelEl.value;

    const imgSrc = this.vehicleImages[this.state.vehicle.size] || "assets/suv-7seat-vector.png";
    this.state.vehicle.img = imgSrc;

    if (mainImgEl) mainImgEl.src = imgSrc;
    if (mini1El) mini1El.src = imgSrc;
    if (mini2El) mini2El.src = imgSrc;
  },

  goToStage3B() {
    this.updateVehiclePreview();

    // Adjust trophy tier prices deterministically based on vehicle size & service
    const sizeMultiplier = {
      coupe: 0.9,
      sedan: 1.0,
      crossover: 1.1,
      suv_truck: 1.2,
      xl_suv: 1.35,
      van_sprinter: 1.5
    }[this.state.vehicle.size] || 1.2;

    const baseMaint = Math.round(250000 * (sizeMultiplier / 1.2) / 10000) * 10000;
    const baseGold = Math.round(350000 * (sizeMultiplier / 1.2) / 10000) * 10000;
    const baseMaster = Math.round(500000 * (sizeMultiplier / 1.2) / 10000) * 10000;

    const priceMaintEl = document.getElementById("priceMaint");
    const priceGoldEl = document.getElementById("priceGold");
    const priceMasterEl = document.getElementById("priceMaster");

    if (priceMaintEl) priceMaintEl.innerText = `Gs. ${baseMaint.toLocaleString("es-PY")}`;
    if (priceGoldEl) priceGoldEl.innerText = `Gs. ${baseGold.toLocaleString("es-PY")}`;
    if (priceMasterEl) priceMasterEl.innerText = `Gs. ${baseMaster.toLocaleString("es-PY")}`;

    this.goToStep('3B');
  },

  selectTier(id, name, duration, price) {
    const sizeMultiplier = {
      coupe: 0.9,
      sedan: 1.0,
      crossover: 1.1,
      suv_truck: 1.2,
      xl_suv: 1.35,
      van_sprinter: 1.5
    }[this.state.vehicle.size] || 1.2;

    const calculatedPrice = Math.round(price * (sizeMultiplier / 1.2) / 10000) * 10000;

    this.state.tier = {
      id,
      name,
      durationMinutes: duration,
      priceGs: calculatedPrice
    };

    const schedSub = document.getElementById("gdSchedSub");
    const hours = (duration / 60).toFixed(1).replace(".0", "");
    if (schedSub) {
      schedSub.innerText = `${name} · ${hours} hours (${duration} min)`;
    }

    this.goToStep(4);
  },

  renderCalendar() {
    const monthTextEl = document.getElementById("gdCalMonthText");
    const daysGridEl = document.getElementById("gdCalDaysGrid");
    if (!daysGridEl) return;

    const year = this.state.calYear;
    const month = this.state.calMonth;

    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    if (monthTextEl) {
      monthTextEl.innerText = `${monthNames[month]} ${year}`;
    }

    // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    let daysHtml = "";

    // Empty lead cells
    for (let i = 0; i < firstDay; i++) {
      daysHtml += `<div class="gd-cal-day disabled"></div>`;
    }

    // Days of the month
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d);
      const isSunday = dateObj.getDay() === 0; // Strictly closed on Sundays (GEMINI.md Rule 1)
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = dateStr === this.state.schedule.date;

      if (isSunday) {
        daysHtml += `<div class="gd-cal-day sunday" title="Cerrado los domingos">${d}</div>`;
      } else {
        const activeClass = isSelected ? " active" : "";
        daysHtml += `<div class="gd-cal-day${activeClass}" onclick="gdWizard.selectDate('${dateStr}', '${d}', '${monthNames[month]}')">${d}</div>`;
      }
    }

    daysGridEl.innerHTML = daysHtml;
  },

  selectDate(dateStr, dayNum, monthName) {
    this.state.schedule.date = dateStr;
    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const parts = dateStr.split("-");
    const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = dayNames[dObj.getDay()];

    this.state.schedule.dateFormatted = `${dayOfWeek}, ${dayNum} de ${monthName}`;
    this.renderCalendar();
  },

  prevMonth() {
    if (this.state.calMonth === 0) {
      this.state.calMonth = 11;
      this.state.calYear -= 1;
    } else {
      this.state.calMonth -= 1;
    }
    this.renderCalendar();
  },

  nextMonth() {
    if (this.state.calMonth === 11) {
      this.state.calMonth = 0;
      this.state.calYear += 1;
    } else {
      this.state.calMonth += 1;
    }
    this.renderCalendar();
  },

  selectTime(timeStr) {
    this.state.schedule.time = timeStr;
    const timeLabels = {
      "08:30": "8:30 AM",
      "10:30": "10:30 AM",
      "12:30": "12:30 PM",
      "14:30": "2:30 PM",
      "16:30": "4:30 PM"
    };
    this.state.schedule.timeFormatted = timeLabels[timeStr] || timeStr;

    document.querySelectorAll(".gd-time-pill-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.time === timeStr);
    });
  },

  goToStep5() {
    if (!this.state.schedule.date) {
      toast.show("Por favor seleccioná un día en el calendario.", "error");
      return;
    }

    // Populate Review elements
    const revServiceTier = document.getElementById("revServiceTier");
    const revDuration = document.getElementById("revDuration");
    const revVehicleSummary = document.getElementById("revVehicleSummary");
    const revLocationSummary = document.getElementById("revLocationSummary");
    const revDateSummary = document.getElementById("revDateSummary");
    const revTotalPrice = document.getElementById("revTotalPrice");

    const hours = (this.state.tier.durationMinutes / 60).toFixed(1).replace(".0", "");

    if (revServiceTier) {
      revServiceTier.innerText = `${this.state.service.name} — ${this.state.tier.name}`;
    }
    if (revDuration) {
      revDuration.innerText = `${hours} horas (${this.state.tier.durationMinutes} min) de tratamiento`;
    }
    if (revVehicleSummary) {
      revVehicleSummary.innerText = `${this.state.vehicle.year} ${this.state.vehicle.make} ${this.state.vehicle.model} (${this.state.vehicle.sizeLabel})`;
    }
    if (revLocationSummary) {
      const locTypeLabel = this.state.location.type === 'location' ? 'At Your Location' : 'At Our Shop';
      revLocationSummary.innerText = `${locTypeLabel} — ${this.state.location.address}, ${this.state.location.city}`;
    }
    if (revDateSummary) {
      revDateSummary.innerText = `${this.state.schedule.dateFormatted} a las ${this.state.schedule.timeFormatted}`;
    }
    if (revTotalPrice) {
      revTotalPrice.innerText = `Gs. ${this.state.tier.priceGs.toLocaleString("es-PY")}`;
    }

    this.goToStep(5);
  },

  async handleSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("gdClientName").value.trim();
    const phone = document.getElementById("gdClientPhone").value.trim();
    const email = document.getElementById("gdClientEmail").value.trim();
    const notes = document.getElementById("gdClientNotes").value.trim();

    if (!name || !phone || !email) {
      toast.show("Por favor completá todos los campos requeridos (*).", "error");
      return;
    }

    this.state.client = { fullName: name, phone, email, notes };

    const submitBtn = document.getElementById("gdSubmitBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="loading-spinner"></span> Confirmando Turno...`;
    }

    // Map size to GEMINI.md allowed categories
    let mappedCategory = "suv_mediana";
    if (this.state.vehicle.size === "coupe" || this.state.vehicle.size === "sedan") {
      mappedCategory = "sedan_hatchback";
    } else if (this.state.vehicle.size === "xl_suv" || this.state.vehicle.size === "van_sprinter") {
      mappedCategory = "pickup_suv_grande";
    }

    // Normalized GEMINI.md Payload
    const payload = {
      client: {
        fullName: name,
        email: email,
        phone: phone,
        userId: "usr_gd_" + Math.random().toString(36).substring(2, 7)
      },
      vehicle: {
        category: mappedCategory,
        brand: this.state.vehicle.make,
        model: this.state.vehicle.model,
        year: parseInt(this.state.vehicle.year, 10) || 2024,
        plate: "N/A"
      },
      services: [
        {
          id: this.state.service.id,
          name: `${this.state.service.name} (${this.state.tier.name})`,
          durationMinutes: this.state.tier.durationMinutes
        }
      ],
      schedule: {
        date: this.state.schedule.date,
        time: this.state.schedule.time
      },
      location: {
        city: this.state.location.city,
        address: this.state.location.address,
        notes: notes || "Reserva desde wizard 5 pasos GoDetail"
      },
      pricing: {
        totalMinutes: this.state.tier.durationMinutes,
        hourlyRateGs: APP_CONFIG.HOURLY_RATE_GS,
        totalPriceGs: this.state.tier.priceGs,
        paymentMethod: "pay_on_completion"
      }
    };

    console.log("🚀 Booking Submitted Successfully:", payload);

    // Format WhatsApp Message
    const waText = `¡Hola Paraguay Detail! Acabo de completar mi reserva online con los siguientes datos:\n\n` +
      `👤 *Cliente:* ${name} (${phone})\n` +
      `✨ *Servicio:* ${this.state.service.name} — ${this.state.tier.name}\n` +
      `🚗 *Vehículo:* ${this.state.vehicle.year} ${this.state.vehicle.make} ${this.state.vehicle.model} (${this.state.vehicle.sizeLabel})\n` +
      `📍 *Ubicación:* ${this.state.location.address}, ${this.state.location.city}\n` +
      `📅 *Fecha & Turno:* ${this.state.schedule.dateFormatted} a las ${this.state.schedule.timeFormatted}\n` +
      `💰 *Total a Pagar:* Gs. ${this.state.tier.priceGs.toLocaleString("es-PY")} (Pago al finalizar)\n\n` +
      `¿Podrían confirmarme la disponibilidad en su agenda? ¡Muchas gracias!`;

    const waUrl = `https://wa.me/595981123456?text=${encodeURIComponent(waText)}`;

    // Simulate backend response
    await new Promise(r => setTimeout(r, 600));

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="check" style="width: 20px; height: 20px;"></i> ¡Reserva Confirmada!`;
      if (window.lucide) lucide.createIcons();
    }

    toast.show("¡Reserva confirmada con éxito! Redirigiendo a WhatsApp...", "success");

    setTimeout(() => {
      window.open(waUrl, "_blank");
    }, 800);
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

/**
 * =========================================================================
 * 9. MOBILE NAVIGATION DRAWER CONTROLLER
 * =========================================================================
 */
const mobileNav = {
  isOpen: false,
  servicesOpen: false,

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    this.isOpen = true;
    const drawer = document.getElementById("mobileNavDrawer");
    const overlay = document.getElementById("mobileNavOverlay");
    const toggleBtn = document.getElementById("mobileMenuToggleBtn");
    if (drawer) {
      drawer.classList.add("active");
      drawer.setAttribute("aria-hidden", "false");
    }
    if (overlay) overlay.classList.add("active");
    if (toggleBtn) toggleBtn.classList.add("active");
    document.body.style.overflow = "hidden";
    if (window.lucide) lucide.createIcons();
  },

  close() {
    this.isOpen = false;
    const drawer = document.getElementById("mobileNavDrawer");
    const overlay = document.getElementById("mobileNavOverlay");
    const toggleBtn = document.getElementById("mobileMenuToggleBtn");
    if (drawer) {
      drawer.classList.remove("active");
      drawer.setAttribute("aria-hidden", "true");
    }
    if (overlay) overlay.classList.remove("active");
    if (toggleBtn) toggleBtn.classList.remove("active");
    document.body.style.overflow = "";
  },

  toggleServices() {
    this.servicesOpen = !this.servicesOpen;
    const list = document.getElementById("mobileServicesList");
    const arrow = document.getElementById("mobileServicesArrow");
    if (list) list.classList.toggle("active", this.servicesOpen);
    if (arrow) arrow.classList.toggle("rotated", this.servicesOpen);
    if (window.lucide) lucide.createIcons();
  }
};

// Global Bootstrapping
document.addEventListener("DOMContentLoaded", () => {
  wizard.init();
  baSlider.init();
  faqAccordion.init();
  reviewsModule.init();
  pricingSimulator.init();
  gdWizard.init();

  const authBtn = document.getElementById("openAuthModalBtn");
  if (authBtn) authBtn.addEventListener("click", () => auth.openModal());

  // Sticky Floating Navbar Scroll Handler
  const navWrapper = document.getElementById("navbarWrapper");
  if (navWrapper) {
    const handleScroll = () => {
      navWrapper.classList.toggle("scrolled", window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
  }

  // Close mobile drawer on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileNav.isOpen) {
      mobileNav.close();
    }
  });
});


