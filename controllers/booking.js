const Booking = require('../models/Booking');
const Campground = require('../models/Campground');
const {isDay, spotsLeft} = require('../utils/booking');

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
        const { checkInDate, checkOutDate } = req.body;

        // Check if campground exists
        const campground = await Campground.findById(req.params.campgroundId);
        if (!campground) {
            return res.status(404).json({
                success: false,
                message: `No campground with the id of ${req.params.campgroundId}`
            });
        }

        if (!checkInDate || !checkOutDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both checkInDate and checkOutDate'
            });
        }

        if (!isDay(checkInDate) || !isDay(checkOutDate)) {
            return res.status(400).json({
                success: false,
                message: 'Dates must be in YYYY-MM-DD format'
            });
        }

        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);

        // Check-out must be after check-in
        if (end <= start) {
            return res.status(400).json({
                success: false,
                message: 'Check-out date must be after check-in date'
            });
        }

        // Stay cannot be more than 3 nights
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) {
            return res.status(400).json({
                success: false,
                message: 'Stay cannot be more than 3 nights'
            });
        }

        // Check-in cannot be before today's UTC date
        const todayUTC = new Date(new Date().toISOString().slice(0, 10));
        if (start < todayUTC) {
            return res.status(400).json({
                success: false,
                message: 'Check-in date cannot be in the past'
            });
        }

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
        if (await spotsLeft(campground, start, end) === 0) {
            return res.status(400).json({
                success: false,
                message: 'Campground is full during the requested dates'
            });
        }

        // shortcut: the checks above and this create are separate calls, so parallel requests can overbook; use a transaction if real traffic arrives
        // Create booking (user taken from token, never from body)
        const booking = await Booking.create({
            user: req.user.id,
            campground: req.params.campgroundId,
            checkInDate: start,
            checkOutDate: end,
            status: 'confirmed'
        });

        res.status(201).json({
            success: true,
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
//@route    POST /api/v1/bookings/:id
//@access   Private
exports.updateBooking = async(req,res,next) => {
    try{
        const {checkInDate, checkOutDate} = req.body;

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
            })
         }

         if (!checkInDate || !checkOutDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide either checkInDate or checkOutDate'
            });
        }

        if (!isDay(checkInDate) || !isDay(checkOutDate)) {
            return res.status(400).json({
                success: false,
                message: 'Dates must be in YYYY-MM-DD format'
            });
        }

        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);

        if(end <= start){
            return res.status(400).json({
                success: false,
                message: 'Check-out date must be after check-in date'
            })
        }

        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) {
            return res.status(400).json({ success: false, message: 'Stay cannot be more than 3 nights' });
        }

        const todayUTC = new Date(new Date().toISOString().slice(0, 10));
        if (start < todayUTC) {
            return res.status(400).json({ success: false, message: 'Check-in date cannot be in the past' });
        }

        const campground = await Campground.findById(booking.campground);

        if (await spotsLeft(campground, start, end, booking._id) === 0) {
            return res.status(400).json({
                success: false,
                message: 'Campground is full during the requested dates'
            });
        }

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