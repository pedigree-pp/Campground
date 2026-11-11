const express = require('express');
const mongoose = require('mongoose');
const {getBookings, getBooking, createBooking, updateBooking, deleteBooking, confirmBooking, expireBooking} = require('../controllers/booking');
const {protect, authorize, verifyQstash} = require('../middleware/auth');

const router = express.Router({mergeParams:true});

// An id that cannot exist is a 404, not a server error
router.param('id', (req, res, next, id) => {
    if (!mongoose.isValidObjectId(id)) {
        return res.status(404).json({
            success: false,
            message: `No booking with the id of ${id}`
        });
    }

    next();
});

// QStash calls this with a signature instead of a login, so it goes before protect
router.route('/:id/expire')
    .post(verifyQstash, expireBooking);

router.use(protect);

router.route('/')
    .get(getBookings)
    .post(authorize('admin', 'user'), createBooking);

router.route('/:id/confirm')
    .put(authorize('admin', 'user'), confirmBooking);

router.route('/:id')
    .get(getBooking)
    .put(authorize('admin', 'user'), updateBooking)
    .delete(authorize('admin','user'), deleteBooking);

module.exports = router;
