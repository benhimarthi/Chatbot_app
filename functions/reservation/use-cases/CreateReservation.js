const ReservationEntity = require("../entities/Reservation");

/**
 * Handles validation, availability checks, alternative recommendations, and persistence of reservations.
 */
class CreateReservation {
  constructor(reservationRepository) {
    this.repository = reservationRepository;
  }

  async execute({ business_id, guests, date, start_time, customer_name, customer_phone }) {
    // 1. Retrieve Workspace / Restaurant settings
    const workspaceSettings = await this.repository.findWorkspaceSettings(business_id);
    if (!workspaceSettings) {
      throw new Error(`Workspace workspace configuration not found for business: ${business_id}`);
    }

    // Resolve restaurant configuration parameters or default to healthy fallbacks
    const config = {
      bookingEnabled: workspaceSettings.bookingEnabled !== undefined ? !!workspaceSettings.bookingSettings?.bookingEnabled || !!workspaceSettings.bookingEnabled : false,
      capacity: Number(workspaceSettings.capacity || workspaceSettings.bookingSettings?.capacity || 20),
      reservationDuration: Number(workspaceSettings.reservationDuration || workspaceSettings.bookingSettings?.reservationDuration || 90),
      openingHours: {
        start: workspaceSettings.openingHours?.start || workspaceSettings.bookingSettings?.openingHours?.start || "08:00",
        end: workspaceSettings.openingHours?.end || workspaceSettings.bookingSettings?.openingHours?.end || "22:00"
      }
    };

    if (!config.bookingEnabled) {
      throw new Error("Table reservations are currently disabled or deactivated on this workspace.");
    }

    // 2. Validate overall guest limit
    const numGuests = Number(guests);
    if (numGuests > config.capacity) {
      throw new Error(`Your requested guest size surpasses our maximum capacity of ${config.capacity} guests.`);
    }

    // 3. Keep date range sane (only today or future dates)
    const reqDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reqDate < today) {
      throw new Error("Reservations can only be requested for today or a future date.");
    }

    // 4. Time Check
    const [hours, minutes] = start_time.split(':').map(Number);
    const requestedMinutes = hours * 60 + minutes;
    const [startH, startM] = config.openingHours.start.split(':').map(Number);
    const [endH, endM] = config.openingHours.end.split(':').map(Number);
    const startVal = startH * 60 + startM;
    const endVal = endH * 60 + endM;

    if (requestedMinutes < startVal || requestedMinutes > endVal) {
      throw new Error(`The requested slot is outside our opening hours (${config.openingHours.start} - ${config.openingHours.end}).`);
    }

    if (requestedMinutes + config.reservationDuration > endVal) {
      const maxMinutes = endVal - config.reservationDuration;
      const latestH = Math.floor(maxMinutes / 60).toString().padStart(2, '0');
      const latestM = (maxMinutes % 60).toString().padStart(2, '0');
      throw new Error(`The booking is too late. The latest slot we can process is ${latestH}:${latestM}.`);
    }

    // 5. Calculate correct end time
    const end_time = ReservationEntity.calculateEndTime(start_time, config.reservationDuration);

    // 6. Instantiate Entity and Validate static rules
    const reservation = new ReservationEntity({
      business_id,
      guests: numGuests,
      date,
      start_time,
      end_time,
      status: "confirmed",
      customer_name,
      customer_phone
    });
    reservation.validate();

    // 7. Overlap Availability Check
    const existingBookings = await this.repository.findReservationsByWorkspaceAndDate(business_id, date);
    const availability = this.checkAvailabilityForTime(requestedMinutes, numGuests, existingBookings, config);

    if (!availability.available) {
      // Find and supply alternatives safely
      const alternatives = await this.suggestAlternatives(business_id, requestedMinutes, numGuests, date, existingBookings, config);
      const err = new Error("No availability for the requested time slot.");
      err.code = "CAPACITY_EXCEEDED";
      err.alternatives = alternatives;
      err.remaining = availability.remaining;
      throw err;
    }

    // 8. Save Reservation Document and Upsert Customer Profile
    const reservationId = await this.repository.saveReservation(reservation);
    await this.repository.upsertCustomer(business_id, customer_name, customer_phone);

    return {
      success: true,
      reservationId,
      reservation: {
        id: reservationId,
        business_id,
        guests: numGuests,
        date,
        start_time,
        end_time,
        status: "confirmed",
        customer_name,
        customer_phone
      }
    };
  }

  checkAvailabilityForTime(targetMinutes, guests, existingBookings, config) {
    const start = targetMinutes;
    const end = start + config.reservationDuration;

    const overlapping = existingBookings.filter(booking => {
      const [bh, bm] = booking.start_time.split(':').map(Number);
      const [beh, bem] = booking.end_time.split(':').map(Number);
      const bStart = bh * 60 + bm;
      const bEnd = beh * 60 + bem;

      return bStart < end && bEnd > start;
    });

    const usedCapacity = overlapping.reduce((sum, b) => sum + (Number(b.guests) || 0), 0);
    const remaining = config.capacity - usedCapacity;

    return {
      available: remaining >= guests,
      remaining
    };
  }

  async suggestAlternatives(businessId, requestedMinutes, guests, date, existingBookings, config) {
    const alternatives = [];
    const [startH, startM] = config.openingHours.start.split(':').map(Number);
    const [endH, endM] = config.openingHours.end.split(':').map(Number);
    const currentStart = startH * 60 + startM;
    const currentEnd = endH * 60 + endM;

    for (let time = currentStart; time <= currentEnd - config.reservationDuration; time += 30) {
      if (Math.abs(time - requestedMinutes) < 180 && time !== requestedMinutes) {
        const hh = Math.floor(time / 60).toString().padStart(2, '0');
        const mm = (time % 60).toString().padStart(2, '0');
        const slotStr = `${hh}:${mm}`;

        const availability = this.checkAvailabilityForTime(time, guests, existingBookings, config);
        if (availability.available) {
          alternatives.push(slotStr);
        }
      }
      if (alternatives.length >= 3) break;
    }

    return alternatives;
  }
}

module.exports = CreateReservation;
