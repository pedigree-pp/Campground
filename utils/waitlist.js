const Booking = require('../models/Booking');
const Campground = require('../models/Campground');
const { spotsLeft } = require('./booking');

// Offer the free Spots at a Campground to its Waitlist, oldest queuedAt first
async function offerFreeSpots(campgroundId) {
    const campground = await Campground.findById(campgroundId);
    const waiting = await Booking.find({ campground: campgroundId, status: 'waiting' }).sort('queuedAt');

    // shortcut: this runs apart from the Booking checks, so parallel requests can overbook; use a transaction if real traffic arrives
    // Spots are counted again for each Booking, so one taken by an Offer here is not offered twice. A Booking blocked on any Night is skipped
    for (const booking of waiting) {
        if (await spotsLeft(campground, booking.checkInDate, booking.checkOutDate) > 0) {
            booking.status = 'offered';
            booking.offeredAt = new Date();
            await booking.save();
        }
    }
}

module.exports = { offerFreeSpots };
