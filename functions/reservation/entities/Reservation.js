/**
 * Reservation entity following SOLID principles (Single Responsibility Principle)
 */
class Reservation {
  constructor({ id, business_id, guests, date, start_time, end_time, status, customer_name, customer_phone, created_at }) {
    this.id = id;
    this.business_id = business_id;
    this.guests = Number(guests);
    this.date = date; // YYYY-MM-DD
    this.start_time = start_time; // HH:mm
    this.end_time = end_time; // HH:mm
    this.status = status || "confirmed";
    this.customer_name = customer_name;
    this.customer_phone = customer_phone;
    this.created_at = created_at;
  }

  /**
   * Validates static attributes of the reservation.
   * Does not check database state (e.g. overlap limits), which is part of the reservation use cases.
   */
  validate() {
    if (!this.business_id || typeof this.business_id !== 'string') {
      throw new Error("Invalid or missing business ID.");
    }
    if (isNaN(this.guests) || this.guests <= 0) {
      throw new Error("Number of guests must be a positive number.");
    }
    if (!this.date || !/^\d{4}-\d{2}-\d{2}$/.test(this.date)) {
      throw new Error("Date must be in YYYY-MM-DD format.");
    }
    if (!this.start_time || !/^\d{2}:\d{2}$/.test(this.start_time)) {
      throw new Error("Start time must be in HH:mm format.");
    }
    if (!this.end_time || !/^\d{2}:\d{2}$/.test(this.end_time)) {
      throw new Error("End time must be in HH:mm format.");
    }
    if (!this.customer_name || typeof this.customer_name !== 'string' || this.customer_name.trim().length === 0) {
      throw new Error("Customer name is required.");
    }
    if (!this.customer_phone || typeof this.customer_phone !== 'string' || this.customer_phone.trim().length === 0) {
      throw new Error("Customer phone number is required.");
    }

    // Ensure start_time is before end_time
    const [startH, startM] = this.start_time.split(':').map(Number);
    const [endH, endM] = this.end_time.split(':').map(Number);
    if (startH * 60 + startM >= endH * 60 + endM) {
      throw new Error("Start time must be strictly before end time.");
    }
  }

  static calculateEndTime(startTimeStr, reservationDurationInMinutes) {
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const startVal = hours * 60 + minutes;
    const endVal = startVal + reservationDurationInMinutes;
    const endH = Math.floor(endVal / 60).toString().padStart(2, '0');
    const endM = (endVal % 60).toString().padStart(2, '0');
    return `${endH}:${endM}`;
  }
}

module.exports = Reservation;
