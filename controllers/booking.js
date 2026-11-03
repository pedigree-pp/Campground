const Booking = require('../models/Booking');
const Campground = require('../models/Campground');

//@desc     Get all bookings
//@route    GET /api/v1/bookings
//@access   Private
exports.getBookings = async(req,res,next)=>{
    try{
        //General users can see only their own bookings
        const filter = req.user.role === 'admin' ? {} : {user: req.user.id};
        if(req.params.campgroundId) filter.campground = req.params.campgroundId;
        const bookings = await Booking.find(filter).populate({path:'campground',select:'name province telephone'});

        res.status(200).json({
            success:true,
            count: bookings.length, 
            data: bookings
        });
    }catch(err){
        res.status(500).json({success:false, message:'Cannot find Booking'});
    }
}

//@desc     Get single bookings
//@route    GET /api/v1/bookings/:id
//@access   Public
exports.getBooking = async(req,res,next)=>{
    try{
        const booking = await Booking.findById(req.params.id).populate({
            path: 'campground',
            select: 'name address telephone'
        });

        if(!booking){
            return res.status(404).json({
                success: false,
                message: `No appointment with the id of ${req.params.id}`
            })
        }

        return res.status(200).json({
                success: true,
                data: booking,
        });

    }catch(err){
        return res.status(500).json({success: false});
    }
}

//@desc     Create booking
//@route    POST /api/v1/hospitals/:campgroundId/appointment
//@access   Public
exports.createCampground = async(req,res,next)=>{
    try
}