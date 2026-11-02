const express = require('express');
const {getCampgrounds, getCampground, createCampground, updateCampground, deleteCampground} = require('../controllers/campground');

const bookingRouter = require('./booking');
const router = express.Router();

//Re-route into other resource routers
router.use('/:campgroundId/bookings', bookingRouter);

router.route('/').get(getCampgrounds).post(createCampground);
router.route('/:id').get(getCampground).put(updateCampground).delete(deleteCampground);

module.exports = router;