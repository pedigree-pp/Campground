const express = require('express');
const {getCampgrounds, getCampground, getAvailability, createCampground, updateCampground, deleteCampground} = require('../controllers/campground');
const {protect, authorize} = require('../middleware/auth');

const bookingRouter = require('./booking');
const router = express.Router();

//Re-route into other resource routers
router.use('/:campgroundId/bookings', bookingRouter);

router.route('/')
    .get(getCampgrounds)
    .post(protect, authorize('admin'), createCampground);
router.route('/:id')
    .get(getCampground)
    .put(protect, authorize('admin'), updateCampground)
    .delete(protect, authorize('admin'), deleteCampground);
router.route('/:id/availability')
    .get(getAvailability);

module.exports = router;