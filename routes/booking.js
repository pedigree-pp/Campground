const express = require('express');
const mongoose = require('mongoose');
const {getBookings, getBooking, createBooking, updateBooking, deleteBooking} = require('../controllers/booking');
const {protect, authorize} = require('../middleware/auth');

const router = express.Router({mergeParams:true});

router.use(protect);

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

router.route('/')
    .get(getBookings)
    .post(authorize('admin', 'user'), createBooking);

router.route('/:id')
    .get(getBooking)
    .put(authorize('admin', 'user'), updateBooking)
    .delete(authorize('admin','user'), deleteBooking);

module.exports = router;
