const Booking = require('../models/Booking');
const Campground = require('../models/Campground');
const {isDay, spotsLeft, dateError, offerHoldMs} = require('../utils/booking');
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

        // An Offer is claimed or left to expire, and an expired Booking only waits for its owner to delete it
        if (booking.status === 'offered' || booking.status === 'expired') {
            return res.status(400).json({
                success: false,
                message: `An ${booking.status} Booking cannot be edited`
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

        const full = await spotsLeft(campground, start, end, booking._id) === 0;

        // A waiting Booking holds no Spot to lose, so full Nights put it back on the Waitlist instead of failing
        if (booking.status === 'confirmed' && full) {
            return res.status(400).json({
                success: false,
                message: 'Campground is full during the requested dates'
            });
        }

        // shortcut: the checks above and this update are separate calls, so parallel requests can overbook; use a transaction if real traffic arrives
        // New dates are a new request, so a Booking still waiting goes to the back of the Waitlist
        const updateBooking = await Booking.findByIdAndUpdate(req.params.id,{
            checkInDate: start,
            checkOutDate: end,
            status: full ? 'waiting' : 'confirmed',
            queuedAt: full ? new Date() : null
        },{ returnDocument: 'after',
            runValidators: true
        });

        // Nights a confirmed Booking moved off are freed for the Waitlist
        // shortcut: if this fails the client gets a 500 though the dates changed, and the Spot waits for the next Offer; use a transaction if real traffic arrives
        if (booking.status === 'confirmed') {
            await offerFreeSpots(booking.campground);
        }

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

        // The Booking can still be offered after its deadline, until the callback or the sweep expires it
        if (Date.now() > booking.offeredAt.getTime() + offerHoldMs()) {
            return res.status(400).json({
                success: false,
                message: 'The claim deadline for this Offer has passed'
            });
        }

        // shortcut: an expiry landing between the checks above and this save is overwritten; use a conditional update if real traffic arrives
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

//@desc     Expire an offered booking when its hold time ends
//@route    POST /api/v1/bookings/:id/expire
//@access   Public, but needs a QStash signature
exports.expireBooking = async (req, res, next) => {
    try {
        // Only a Booking still offered expires, in one step, so a claim at the same moment is not overwritten
        const booking = await Booking.findOneAndUpdate(
            { _id: req.params.id, status: 'offered' },
            { status: 'expired' },
            { returnDocument: 'after' }
        );

        // shortcut: if this fails the Offer is already expired, so the QStash retry does nothing and the Spot waits for the next Offer; use a transaction if real traffic arrives
        if (booking) {
            await offerFreeSpots(booking.campground);
        }

        // A claimed or deleted Booking still gets 200, so QStash does not retry
        res.status(200).json({
            success: true,
            data: booking || {}
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Cannot expire Booking'
        });
    }
};
