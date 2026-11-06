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

// Check the date rules for a stay: returns an error message, or null when all of them pass
function dateError(checkInDate, checkOutDate){
    if (!checkInDate || !checkOutDate) return 'Please provide both checkInDate and checkOutDate';
    if (!isDay(checkInDate) || !isDay(checkOutDate)) return 'Dates must be in YYYY-MM-DD format';

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    // Check-out must be after check-in
    if (end <= start) return 'Check-out date must be after check-in date';

    // Stay cannot be more than 3 nights
    if ((end - start) / (1000 * 60 * 60 * 24) > 3) return 'Stay cannot be more than 3 nights';

    // Check-in cannot be before today's UTC date
    if (start < new Date(new Date().toISOString().slice(0, 10))) return 'Check-in date cannot be in the past';

    return null;
}

module.exports = {isDay, spotsLeft, dateError};
