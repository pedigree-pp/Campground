const Booking = require('../models/Booking');

//@desc     Get all bookings
//@route    GET /api/v1/bookings
//@access   Public
exports.getBookings = async(req,res,next)=>{
    let query;

    //General users can see only their own bookings
    if(req.user.role !== 'admin'){
        query = Booking.find({user:req.user.id})
            .populate({path:'campground',select:'name address telephone'})
    }else{
        if(req.params.campgroundId){
            query = Booking.find({campground: req.params.campgroundId})
                .populate({path:'campground',select:'name address telephone'})
        }else{
            query = Booking.find()
                .populate({path:'campground',select:'name address telephone'})
        }
    }
    try{    
        const bookings = await query;
        res.status(200).json({
            success:true,
            count: bookings.length, 
            data: bookings
        });
    }catch(err){
        res.status(500).json({success:false, message:'Cannot find Booking'})
    }
}
