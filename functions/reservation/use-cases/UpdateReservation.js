const ReservationEntity = require("../entities/Reservation");

/**
 * Handles updating an existing reservation, ensuring date, time or guest count changes
 * respect the system capacity constraints.
 */
class UpdateReservation {
  constructor(reservationRepository) {
    this.repository = reservationRepository;
  }

  async execute(reservationId, updateData) {
    // 1. Fetch current reservation
    const existing = await this.repository.findReservationById(reservationId);
    if (!existing) {
      throw new Error(`Reservation with ID ${reservationId} not found.`);
    }

    const businessId = existing.business_id;

    // 2. Load workspace settings
    const workspaceSettings = await this.repository.findWorkspaceSettings(businessId);
    const config = {
      capacity: Number(workspaceSettings?.capacity || 20),
      reservationDuration: Number(workspaceSettings?.reservationDuration || 90),
      openingHours: {
        start: workspaceSettings?.openingHours?.start || "08:00",
        end: workspaceSettings?.openingHours?.end || "22:00"
      }
    };

    // 3. Keep mutable properties
    const guests = updateData.guests !== undefined ? Number(updateData.guests) : existing.guests;
    const date = updateData.date !== undefined ? updateData.date : existing.date;
    const start_time = updateData.start_time !== undefined ? updateData.start_time : existing.start_time;
    let end_time = existing.end_time;

    // Re-calculate end time if start_time or reservation duration changes
    if (updateData.start_time !== undefined) {
      end_time = ReservationEntity.calculateEndTime(start_time, config.reservationDuration);
    }

    // 4. Construct updated Reservation Entity and validate
    const updatedEntity = new ReservationEntity({
      ...existing,
      guests,
      date,
      start_time,
      end_time,
      customer_name: updateData.customer_name !== undefined ? updateData.customer_name : existing.customer_name,
      customer_phone: updateData.customer_phone !== undefined ? updateData.customer_phone : existing.customer_phone,
      status: updateData.status !== undefined ? updateData.status : existing.status
    });
    updatedEntity.validate();

    // 5. If guests, date or start_time changed, verify overlapping availability
    if (guests !== existing.guests || date !== existing.date || start_time !== existing.start_time) {
      const existingBookings = await this.repository.findReservationsByWorkspaceAndDate(businessId, date);
      // Filter out this specific reservation from the list to avoid counting its own capacity
      const otherBookings = existingBookings.filter(b => b.id !== reservationId);

      const [hours, minutes] = start_time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;

      const start = startMinutes;
      const end = start + config.reservationDuration;

      const overlapping = otherBookings.filter(booking => {
        const [bh, bm] = booking.start_time.split(':').map(Number);
        const [beh, bem] = booking.end_time.split(':').map(Number);
        const bStart = bh * 60 + bm;
        const bEnd = beh * 60 + bem;

        return bStart < end && bEnd > start;
      });

      const usedCapacity = overlapping.reduce((sum, b) => sum + (Number(b.guests) || 0), 0);
      const remaining = config.capacity - usedCapacity;

      if (remaining < guests) {
        throw new Error(`Cannot update reservation. Only ${remaining} capacity remains at the chosen slot, but ${guests} were requested.`);
      }
    }

    // 6. Write changes to the repository
    const payload = {
      guests: updatedEntity.guests,
      date: updatedEntity.date,
      start_time: updatedEntity.start_time,
      end_time: updatedEntity.end_time,
      customer_name: updatedEntity.customer_name,
      customer_phone: updatedEntity.customer_phone,
      status: updatedEntity.status
    };

    await this.repository.updateReservation(reservationId, payload);
    return {
      success: true,
      reservation: {
        id: reservationId,
        business_id: businessId,
        ...payload
      }
    };
  }
}

module.exports = UpdateReservation;
