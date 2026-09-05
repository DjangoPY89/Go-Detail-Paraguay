#!/usr/bin/env python3
"""
Test Payload Validator & Business Logic Engine
Validates JSON payloads against GEMINI.md schemas and rules.
"""

import sys
import json
from datetime import datetime, time

GEO_WHITELIST = ["Asunción", "Luque", "San Lorenzo"]
HOURLY_RATE_GS = 100000
MIN_START_TIME = time(8, 0)
MAX_END_TIME = time(18, 0)

def validate_booking_payload(payload: dict) -> tuple[bool, list[str]]:
    errors = []
    
    # 1. Check required top-level keys
    required_keys = ["client", "vehicle", "services", "schedule", "location", "pricing"]
    for k in required_keys:
        if k not in payload:
            errors.append(f"Missing required key: '{k}'")
    
    if errors:
        return False, errors

    # 2. Client validation
    client = payload.get("client", {})
    for field in ["fullName", "email", "phone"]:
        if not client.get(field):
            errors.append(f"Missing client field: '{field}'")
            
    # 3. Vehicle validation
    vehicle = payload.get("vehicle", {})
    allowed_categories = ["sedan_hatchback", "suv_mediana", "pickup_suv_grande"]
    if vehicle.get("category") not in allowed_categories:
        errors.append(f"Invalid vehicle category '{vehicle.get('category')}'. Must be one of {allowed_categories}")

    # 4. Services validation & Pricing math
    services = payload.get("services", [])
    if not services:
        errors.append("At least one service must be selected.")
    
    calc_total_minutes = sum(s.get("durationMinutes", 0) for s in services)
    expected_price_gs = int((calc_total_minutes / 60.0) * HOURLY_RATE_GS)
    
    pricing = payload.get("pricing", {})
    if pricing.get("totalMinutes") != calc_total_minutes:
        errors.append(f"totalMinutes mismatch: received {pricing.get('totalMinutes')}, expected {calc_total_minutes}")
    if pricing.get("totalPriceGs") != expected_price_gs:
        errors.append(f"totalPriceGs mismatch: received {pricing.get('totalPriceGs')}, expected {expected_price_gs}")
    if pricing.get("paymentMethod") != "pay_on_completion":
        errors.append(f"Invalid payment method: {pricing.get('paymentMethod')}")

    # 5. Location & Geo-whitelist
    location = payload.get("location", {})
    city = location.get("city")
    if city not in GEO_WHITELIST:
        errors.append(f"City '{city}' is outside coverage area. Whitelist: {GEO_WHITELIST}")
    if not location.get("address"):
        errors.append("Address is required.")

    # 6. Schedule & Sunday block
    schedule = payload.get("schedule", {})
    date_str = schedule.get("date")
    time_str = schedule.get("time")
    
    if date_str:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            # Sunday is weekday 6 in Python (Mon=0, Sun=6)
            if dt.weekday() == 6:
                errors.append(f"Date '{date_str}' is a Sunday. Services are closed on Sundays.")
        except ValueError:
            errors.append(f"Invalid date format '{date_str}', expected YYYY-MM-DD")

    if time_str:
        try:
            hour, minute = map(int, time_str.split(":"))
            start_t = time(hour, minute)
            if start_t < MIN_START_TIME:
                errors.append(f"Start time {time_str} is before 08:00")
            
            # Calculate end time
            total_mins = calc_total_minutes
            end_minutes_from_midnight = hour * 60 + minute + total_mins
            end_hour = end_minutes_from_midnight // 60
            end_min = end_minutes_from_midnight % 60
            
            if end_minutes_from_midnight > (18 * 60):
                errors.append(f"Service duration extends past 18:00 (estimated end: {end_hour:02d}:{end_min:02d})")
        except Exception as e:
            errors.append(f"Error parsing time '{time_str}': {str(e)}")

    return len(errors) == 0, errors

def run_tests():
    print("🧪 Running deterministic payload validation tests...")
    
    # Valid Test Case
    valid_payload = {
        "client": {
            "fullName": "Carlos Gonzalez",
            "email": "carlos@example.com",
            "phone": "+595981123456",
            "userId": "usr_991"
        },
        "vehicle": {
            "category": "suv_mediana",
            "brand": "Honda",
            "model": "CR-V",
            "year": 2023,
            "plate": "ABC 456"
        },
        "services": [
            {"id": "detailing_basico", "name": "Detailing Básico", "durationMinutes": 180},
            {"id": "pulido_faros", "name": "Pulido de Faros", "durationMinutes": 40}
        ],
        "schedule": {
            "date": "2026-09-08", # Tuesday
            "time": "09:00"
        },
        "location": {
            "city": "Asunción",
            "address": "Av. Santa Teresa 1827",
            "notes": "Casa con portón blanco"
        },
        "pricing": {
            "totalMinutes": 220,
            "hourlyRateGs": 100000,
            "totalPriceGs": 366666, # (220/60) * 100000 = 366666
            "paymentMethod": "pay_on_completion"
        }
    }
    
    ok, errors = validate_booking_payload(valid_payload)
    assert ok, f"Valid payload failed validation: {errors}"
    print("✅ Valid payload test passed!")

    # Invalid Test Case 1: Sunday rejection
    sunday_payload = dict(valid_payload)
    sunday_payload["schedule"] = {"date": "2026-09-06", "time": "10:00"} # 2026-09-06 is Sunday
    ok, errors = validate_booking_payload(sunday_payload)
    assert not ok and any("Sunday" in e for e in errors), f"Sunday check failed to trigger: {errors}"
    print("✅ Sunday rejection test passed!")

    # Invalid Test Case 2: Out of bounds Geo
    geo_payload = dict(valid_payload)
    geo_payload["location"] = {"city": "Capiatá", "address": "Ruta 2"}
    ok, errors = validate_booking_payload(geo_payload)
    assert not ok and any("coverage area" in e for e in errors), f"Geo check failed to trigger: {errors}"
    print("✅ Geo whitelist test passed!")

    # Invalid Test Case 3: Overtime service (ends after 18:00)
    overtime_payload = dict(valid_payload)
    overtime_payload["schedule"] = {"date": "2026-09-08", "time": "16:00"} # 16:00 + 220m = 19:40
    ok, errors = validate_booking_payload(overtime_payload)
    assert not ok and any("18:00" in e for e in errors), f"Overtime check failed to trigger: {errors}"
    print("✅ 18:00 Closing time overflow test passed!")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
