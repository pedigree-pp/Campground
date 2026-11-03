const express = require('express');
const {getBookings, getBooking} = require('../controllers/booking');
const {protect} = require('../middleware/auth');

const router = express.Router({mergeParams:true});

router.use(protect);

router.route('/').get(getBookings);
router.route('/:id').get(getBooking);

module.exports = router;