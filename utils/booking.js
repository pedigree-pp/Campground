const Booking = require('../models/Booking');

// Validate YYYY-MM-DD format (must be valid calendar day and stored as midnight UTC)
const isDay = s => typeof s === 'string' && !isNaN(new Date(s)) && new Date(s).toISOString().slice(0, 10) === s;

async function spotsLeft(campground, start, end, excludeBookingId = null){
    const filter = {
        campground: campground._id,
        status: { $in: ['confirmed', 'offered'] },
        checkInDate: { $lt: end },
        checkOutDate: { $gt: start }
    };
    // If an excludeBookingId is passed (e.g. for editing an existing booking), leave it out
    if (excludeBookingId) {
        filter._id = { $ne: excludeBookingId };
    }
    // Fetch the bookings
    const bookings = await Booking.find(filter);

    // Find the fullest night in the range [start, end)
    // (Occupancy can only increase on check-in day or on a day another booking starts)
    let maxOccupied = 0;
    for (const night of [start, ...bookings.map(b => b.checkInDate)]) {
        if (night < start) continue;
        const count = bookings.filter(b => b.checkInDate <= night && night < b.checkOutDate).length;
        maxOccupied = Math.max(maxOccupied, count);
    }
    // Calculate free spots (capacity minus the most crowded night)
    return Math.max(0, campground.capacity - maxOccupied);
}

module.exports = {isDay, spotsLeft};