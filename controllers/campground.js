const Campground = require('../models/Campground');

exports.getCampgrounds = async(req,res,next) => {
    try{
        const campgrounds = await Campground.find();
        res.status(200).json({success:true, data:campgrounds}); 
    }catch(err){
        res.status(400).json({success:false});
    }
}

exports.getCampground = async(req,res,next) => {
    try{
        const campground = await Campground.findById(req.params.id);

        if(!campground){
            return res.status(400).json({success:false, msg:"Campground Not Found"});
        }

        res.status(200).json({success:true, data:campground});
    }catch(err){
        res.status(400).json({success:false});
    }
}

exports.createCampground = async(req,res,next) => {
    try{
        const campground = await Campground.create(req.body);
        res.status(201).json({success:true, data:campground});
    }catch(err){
        res.status(400).json({success:false});
    }
}

exports.updateCampground = async(req,res,next) => {
    try{
        const campground = await Campground.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: 'after',
            runValidators: true
        });
        
        if(!campground){
            return res.status(400).json({success:false});
        }

        res.status(200).json({success:true, data:campground});
    }catch(err){
        res.status(400).json({success:false});
    }
}

exports.deleteCampground = async(req,res,next) => {
    try{
        const campground = await Campground.findByIdAndDelete(req.params.id);
        
        if(!campground){
            return res.status(400).json({success:false});
        }

        res.status(200).json({success:true, data: {}});
    }catch(err){
        res.status(400).json({success:false});
    }
}