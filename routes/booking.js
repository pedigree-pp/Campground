const express = require('express');
const {getBookings, getBooking, createBooking, updateBooking, deleteBooking} = require('../controllers/booking');
const {protect, authorize} = require('../middleware/auth');

const router = express.Router({mergeParams:true});

router.use(protect);

router.route('/')
    .get(getBookings)
    .post(authorize('admin', 'user'), createBooking);

router.route('/:id')
    .get(getBooking)
    .put(authorize('admin', 'user'), updateBooking)
    .delete(authorize('admin','user'), deleteBooking);

module.exports = router;
