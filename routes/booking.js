const express = require('express');
const {getBookings, getBooking, createBooking} = require('../controllers/booking');
const {protect, authorize} = require('../middleware/auth');

const router = express.Router({mergeParams:true});

router.use(protect);

router.route('/').get(getBookings).post(authorize('admin', 'user'), createBooking);

router.route('/:id').get(getBooking);

module.exports = router;
