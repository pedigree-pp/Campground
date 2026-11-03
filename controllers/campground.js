const Campground = require('../models/Campground');
const Booking = require('../models/Booking');

//@desc     Get all campgrounds
//@route    GET /api/v1/campgrounds
//@access   Public
exports.getCampgrounds = async(req,res,next) => {
    let query;
        
    //Copy req.query
    const reqQuery = {...req.query};

    //fields to exclude
    const removeFields = ['select','sort','page','limit'];

    //Loop over remove fields and delete them from reqQuery
    removeFields.forEach(param=>delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/"(gt|gte|lt|lte|in)":/g, (match, op)=>`"$${op}":`);

    query = Campground.find(JSON.parse(queryStr));

    //Select Fields
    if(req.query.select){
        const fields = req.query.select.split(',').join(' ');
        query = query.select(fields);
    }

        //Sort Fields
        if(req.query.sort){
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        }else{
            query = query.sort('-_id');
        }

    //Pagination
    const page = parseInt(req.query.page,10) || 1;
    const limit = parseInt(req.query.limit,10) || 25;
    const startIndex = (page-1)*limit;
    const endIndex = page*limit;
    const total = await Campground.countDocuments(query.getFilter());

    query = query.skip(startIndex).limit(limit);

    try{
        const campgrounds = await query;

        const pagination = {};

        if(endIndex < total){
            pagination.next = {
                page: page+1,
                limit
            }
        }

        if(startIndex > 0){
            pagination.prev = {
                page: page-1,
                limit
            }
        }

        res.status(200).json({
            success:true, 
            count: campgrounds.length,
            pagination, 
            data: campgrounds
        }); 
    }catch(err){
        res.status(400).json({success:false});
    }
}

//@desc     Get single campground
//@route    GET /api/v1/campgrounds/:id
//@access   Public
exports.getCampground = async(req,res,next) => {
    try{
        const campground = await Campground.findById(req.params.id);

        if(!campground){
            return res.status(404).json({success:false, msg:"Campground Not Found"});
        }

        res.status(200).json({success:true, data:campground});
    }catch(err){
        res.status(400).json({success:false});
    }
}

//@desc     Get availability
//@route    GET /api/v1/campgrounds/:id/availability
//@access   Public
exports.getAvailability = async(req,res,next) => {
    try{
        const {checkInDate,checkOutDate} = req.query;

        //Validate checkInDate and checkOutDate
        if(!checkInDate || !checkOutDate){
            return res.status(400).json({
                success:false,
                message: 'Please provide both checkInDate and checkOutDate'
            });
        }

        // Rejects bad formats and impossible days like 2026-02-30
        const isDay = s => !isNaN(new Date(s)) && new Date(s).toISOString().slice(0, 10) === s;
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);

        if (!isDay(checkInDate) || !isDay(checkOutDate) || end <= start) {
            return res.status(400).json({ success: false });
        }

        const campground = await Campground.findById(req.params.id);
        
        if(!campground){
            return res.status(404).json({ 
                success: false, 
                message: 'Campground not found' 
            });
        }

        const bookings = await Booking.find({
            campground: req.params.id,
            status: { $in: ['confirmed', 'offered']},
            checkInDate: {$lt: end},
            checkOutDate: {$gt: start},
        });

        //The fullest Night is check-in or a Night when another Booking starts
        let maxOccupied = 0;
        for (const night of [start, ...bookings.map(b => b.checkInDate)]) {
            if (night < start) continue;
            const count = bookings.filter(b => b.checkInDate <= night && night < b.checkOutDate).length;
            maxOccupied = Math.max(maxOccupied, count);
        }
        const spotsLeft = Math.max(0, campground.capacity - maxOccupied);

        return res.status(200).json({
            success: true,
            data: {
                available: spotsLeft > 0,
                spotsLeft: spotsLeft,
                capacity: campground.capacity
            }
        });
    }catch(err){
        return res.status(400).json({success:false});
    }
}

//@desc     Create new campground
//@route    POST /api/v1/campgrounds
//@access   Private
exports.createCampground = async(req,res,next) => {
    try{
        const campground = await Campground.create(req.body);
        res.status(201).json({success:true, data:campground});
    }catch(err){
        res.status(400).json({success:false});
    }
}

//@desc     Update campground
//@route    PUT /api/v1/campgrounds/:id
//@access   Private
exports.updateCampground = async(req,res,next) => {
    try{
        const campground = await Campground.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: 'after',
            runValidators: true
        });
        
        if(!campground){
            return res.status(404).json({success:false});
        }

        res.status(200).json({success:true, data:campground});
    }catch(err){
        res.status(400).json({success:false});
    }
}

//@desc     Delete campground
//@route    DELETE /api/v1/campgrounds/:id
//@access   Private
exports.deleteCampground = async(req,res,next) => {
    try{
        const campground = await Campground.findByIdAndDelete(req.params.id);
        
        if(!campground){
            return res.status(404).json({success:false});
        }

        await Booking.deleteMany({campground: req.params.id});

        res.status(200).json({success:true, data: {}});
    }catch(err){
        res.status(400).json({success:false});
    }
}
