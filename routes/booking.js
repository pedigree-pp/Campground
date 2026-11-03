const express = require('express');
const {getBookings} = require('../controllers/booking');
const {protect} = require('../middleware/auth');

const router = express.Router({mergeParams:true});

router.route('/').get(protect, getBookings)

module.exports = router;