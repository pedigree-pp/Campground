const Booking = require('../models/Booking');

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
