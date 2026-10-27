exports.getCampgrounds = (req,res,next) => {
    res.status(200).json({success:true, msg:'Show all campgrounds'})
}

exports.getCampground = (req,res,next) => {
    res.status(200).json({success:true, msg:'Show one campground'})
}

exports.createCampground = (req,res,next) => {
    res.status(200).json({success:true, msg:'Create campground successfully'})
}

exports.updateCampground = (req,res,next) => {
    res.status(200).json({success:true, msg:'Update campground successfully'})
}

exports.deleteCampground = (req,res,next) => {
    res.status(200).json({success:true, msg:'Delete campground successfully'})
}