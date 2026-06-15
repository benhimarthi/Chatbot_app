/**
 * Handles deletion of a reservation.
 */
class DeleteReservation {
  constructor(reservationRepository) {
    this.repository = reservationRepository;
  }

  async execute(reservationId) {
    const existing = await this.repository.findReservationById(reservationId);
    if (!existing) {
      throw new Error(`Reservation with ID ${reservationId} not found.`);
    }

    await this.repository.deleteReservation(reservationId);
    return {
      success: true,
      message: `Reservation ${reservationId} deleted successfully.`
    };
  }
}

module.exports = DeleteReservation;
