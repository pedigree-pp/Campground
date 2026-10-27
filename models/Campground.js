const mongoose = require('mongoose');

const CampGroundSchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, 'Please add a name'],
        unique: true,
        trim: true,
        maxlenght: [50, 'Name cannot be more than 50 characters']
    },
    address:{
        type: String,
        required: [true, 'Please add an address']
    },
    district:{
        type: String,
        required: [true, 'Please add a district']
    },
    province:{
        type: String,
        required: [true, 'Please add a province']
    },
    region:{
        type: String,
        required: [true, 'Please add a region']
    },
    postalcode:{
        type: String,
        required: [true, 'Please add a postalcode'],
        maxlenght: [5, 'Postalcode cannot be more than 5 characters']
    },
    telephone:{
        type: String,
        required: [true, 'Please add a telephone number'],
        match: [
            /^0\d{8,9}$/,
            'Please add a valid telephone number starting with 0'
        ]
    },
    capacity:{
        type: Number,
        required: [true, 'Please add capacity'],
        minlenght: [1, 'Capacity must be at least 1']
    },
})

module.exports = mongoose.model('CampGround',CampGroundSchema);