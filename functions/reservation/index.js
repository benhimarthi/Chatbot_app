const functions = require("firebase-functions");
const admin = require("firebase-admin");

const ReservationRepository = require("./repositories/ReservationRepository");
const CreateReservation = require("./use-cases/CreateReservation");
const GetReservations = require("./use-cases/GetReservations");
const UpdateReservation = require("./use-cases/UpdateReservation");
const DeleteReservation = require("./use-cases/DeleteReservation");
const ReservationController = require("./controllers/ReservationController");

/**
 * Initializes and wires up all dependencies for the Reservation module.
 * Following Dependency Injection and SOLID principles.
 */
function createReservationModule(db, adminInstance) {
  const repository = new ReservationRepository(db, adminInstance);

  const createUseCase = new CreateReservation(repository);
  const listUseCase = new GetReservations(repository);
  const updateUseCase = new UpdateReservation(repository);
  const deleteUseCase = new DeleteReservation(repository);

  const controller = new ReservationController({
    createReservation: createUseCase,
    getReservations: listUseCase,
    updateReservation: updateUseCase,
    deleteReservation: deleteUseCase
  });

  return controller;
}

module.exports = {
  createReservationModule
};
