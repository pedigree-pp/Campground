const Booking = require('../models/Booking');
const Campground = require('../models/Campground');
const {isDay, spotsLeft, dateError} = require('../utils/booking');
const { offerFreeSpots } = require('../utils/waitlist');

//@desc     Get all bookings
//@route    GET /api/v1/bookings
//@route    GET /api/v1/campgrounds/:campgroundId/bookings
//@access   Private
exports.getBookings = async (req, res, next) => {
    try {
        // General users can see only their own bookings; admins see all
        const filter = req.user.role === 'admin' ? {} : { user: req.user.id };
        if (req.params.campgroundId) {
            filter.campground = req.params.campgroundId;
        }

        const bookings = await Booking.find(filter).populate({
            path: 'campground',
            select: 'name province telephone'
        });

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

//@desc     Get single booking
//@route    GET /api/v1/bookings/:id
//@access   Private
exports.getBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate({
            path: 'campground',
            select: 'name province telephone'
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: `No booking with the id of ${req.params.id}`
            });
        }

        // Make sure user is the booking owner or an admin
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to view this booking`
            });
        }

        return res.status(200).json({
            success: true,
            data: booking
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

//@desc     Create booking
//@route    POST /api/v1/campgrounds/:campgroundId/bookings
//@access   Private
exports.createBooking = async (req, res, next) => {
    try {
        const { checkInDate, checkOutDate } = req.body || {};

        // Check if campground exists
        const campground = await Campground.findById(req.params.campgroundId);
        if (!campground) {
            return res.status(404).json({
                success: false,
                message: `No campground with the id of ${req.params.campgroundId}`
            });
        }

        const dateErr = dateError(checkInDate, checkOutDate);
        if (dateErr) {
            return res.status(400).json({
                success: false,
                message: dateErr
            });
        }

        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const todayUTC = new Date(new Date().toISOString().slice(0, 10));

        // User can only have at most 3 active bookings (confirmed, waiting, or offered with check-out in the future) - Admins exempt
        if (req.user.role !== 'admin') {
            const activeBookings = await Booking.countDocuments({
                user: req.user.id,
                status: { $in: ['confirmed', 'waiting', 'offered'] },
                checkOutDate: { $gt: todayUTC }
            });
            if (activeBookings >= 3) {
                return res.status(400).json({
                    success: false,
                    message: `The user with ID ${req.user.id} has already made 3 bookings`
                });
            }
        }

        // Capacity check: Any night already has as many Spot-holding Bookings (confirmed or offered) as Capacity
        const full = await spotsLeft(campground, start, end) === 0;

        // shortcut: the checks above and this create are separate calls, so parallel requests can overbook; use a transaction if real traffic arrives
        // Create booking (user taken from token, never from body); a full Campground puts it on the Waitlist
        const booking = await Booking.create({
            user: req.user.id,
            campground: req.params.campgroundId,
            checkInDate: start,
            checkOutDate: end,
            status: full ? 'waiting' : 'confirmed',
            queuedAt: full ? new Date() : null
        });

        res.status(201).json({
            success: true,
            message: full ? 'Campground is full during the requested dates, so the Booking was waitlisted' : undefined,
            data: booking
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Cannot create Booking'
        });
    }
};

//@desc     Update booking
//@route    PUT /api/v1/bookings/:id
//@access   Private
exports.updateBooking = async(req,res,next) => {
    try{
        const {checkInDate, checkOutDate} = req.body || {};

        const booking = await Booking.findById(req.params.id);
        if(!booking){
            return res.status(404).json({
                success: false,
                message: `No booking with the id of ${req.params.id}`
            });
        }

        if(req.user.role == 'user' && booking.user.toString() !== req.user.id){
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to update this booking`
            });
        }

        // A finished stay no longer counts toward the limit of 3, so editing it back to life would get around that limit
        if (booking.checkOutDate <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'A finished stay cannot be edited'
            });
        }

        const dateErr = dateError(checkInDate, checkOutDate);
        if (dateErr) {
            return res.status(400).json({
                success: false,
                message: dateErr
            });
        }

        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);

        const campground = await Campground.findById(booking.campground);
        if (!campground) {
            return res.status(404).json({ success: false, message: 'Campground not found' });
        }

        if (await spotsLeft(campground, start, end, booking._id) === 0) {
            return res.status(400).json({
                success: false,
                message: 'Campground is full during the requested dates'
            });
        }

        // shortcut: the checks above and this update are separate calls, so parallel requests can overbook; use a transaction if real traffic arrives
        const updateBooking = await Booking.findByIdAndUpdate(req.params.id,{
            checkInDate: start,
            checkOutDate: end,
        },{ returnDocument: 'after', 
            runValidators: true 
        });

        res.status(200).json({
            success: true,
            data: updateBooking
        });
    }catch(err){
        return res.status(500).json({
            success: false,
            message: "Cannot update Booking"
        })
    }
}

//@desc     Delete booking
//@route    DELETE /api/v1/bookings/:id
//@access   Private
exports.deleteBooking = async (req,res,next) => {
    try{
        const booking = await Booking.findById(req.params.id);

        if(!booking){
            return res.status(404).json({
                success: false,
                message: `Booking ${req.params.id} is not found`
            })
        }

        if(req.user.role == 'user' && booking.user.toString() !== req.user.id){
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to delete this booking`
            })
        }

        await booking.deleteOne();

        // A deleted Booking that held a Spot frees it for the Waitlist
        // shortcut: if this fails the client gets a 500 though the Booking is gone, and the Spot waits for the next Offer; use a transaction if real traffic arrives
        if (booking.status === 'confirmed' || booking.status === 'offered') {
            await offerFreeSpots(booking.campground);
        }

        res.status(200).json({
            success: true,
            data: {}
        })
    }catch(err){
        return res.status(500).json({
            success: false,
            message: 'Cannot delete Booking'
        })
    }
}

//@desc     Confirm an offered booking
//@route    PUT /api/v1/bookings/:id/confirm
//@access   Private
exports.confirmBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: `No booking with the id of ${req.params.id}`
            });
        }

        // Only the owner can claim an Offer, so unlike edit and delete there is no Admin exception
        if (booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to confirm this booking`
            });
        }

        if (booking.status !== 'offered') {
            return res.status(400).json({
                success: false,
                message: `Only an offered Booking can be confirmed, this one is ${booking.status}`
            });
        }

        booking.status = 'confirmed';
        await booking.save();

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Cannot confirm Booking'
        });
    }
};
