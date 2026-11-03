const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Please add a user reference']
    },
    campground:{
        type: mongoose.Schema.ObjectId,
        ref: 'Campground',
        required: [true, 'Please add a campground reference']
    },
    checkInDate:{
        type: Date,
        required: [true, 'Please add check-in date']
    },
    checkOutDate:{
        type: Date,
        required: [true, 'Please add check-out date']
    },
    status:{
        type: String,
        enum: ['confirmed','waiting','offered','expired'],
        default: 'waiting'
    },
    queuedAt:{
        type: Date,
        default: null
    },
    offeredAt:{
        type: Date,
        default: null
    },
    createdAt:{
        type: Date,
        default: Date.now
    }

})

module.exports = mongoose.model('Booking',BookingSchema);