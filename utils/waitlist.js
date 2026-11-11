const Booking = require('../models/Booking');
const Campground = require('../models/Campground');
const { spotsLeft, offerHoldMs } = require('./booking');
const { sendOfferEmail } = require('./sendEmail');

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

            // Not awaited, so a slow SMTP server or QStash cannot hold up the request
            sendOfferEmail(booking, campground);
            if (process.env.QSTASH_TOKEN) {
                scheduleExpiry(booking);
            }
        }
    }
}

// Never rejects: a failed publish is only logged, and the sweep expires the Offer instead
async function scheduleExpiry(booking) {
    try {
        const callbackUrl = `${process.env.PUBLIC_URL}/api/v1/bookings/${booking._id}/expire`;
        const response = await fetch(`${process.env.QSTASH_URL || 'https://qstash.upstash.io'}/v2/publish/${callbackUrl}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
                // Rounded up, so the callback never arrives before the claim deadline
                'Upstash-Delay': `${Math.ceil(offerHoldMs() / 1000)}s`
            }
        });

        if (!response.ok) {
            throw new Error(`${response.status} ${await response.text()}`);
        }
    } catch (err) {
        console.log(`QStash publish for Booking ${booking._id} failed: ${err.message}`);
    }
}

// The sweep. Never rejects: server.js shuts down on an unhandled rejection
async function expireStale() {
    try {
        // These go first, so no Offer made below goes to a stay that has already started
        const todayUTC = new Date(new Date().toISOString().slice(0, 10));
        await Booking.updateMany({ status: 'waiting', checkInDate: { $lt: todayUTC } }, { status: 'expired' });

        // With QStash timing the Offers, only catch callbacks still missing 5 minutes after the hold time
        const grace = process.env.QSTASH_TOKEN ? 5 * 60 * 1000 : 0;
        const staleOffers = { status: 'offered', offeredAt: { $lt: new Date(Date.now() - offerHoldMs() - grace) } };
        const campgroundIds = await Booking.distinct('campground', staleOffers);
        await Booking.updateMany(staleOffers, { status: 'expired' });

        // shortcut: a failure here leaves these Spots for the next Offer at their Campground, since the Offers are already expired; use a transaction if real traffic arrives
        for (const campgroundId of campgroundIds) {
            await offerFreeSpots(campgroundId);
        }
    } catch (err) {
        console.log(`Expiry sweep failed: ${err.message}`);
    }
}

module.exports = { offerFreeSpots, expireStale };
