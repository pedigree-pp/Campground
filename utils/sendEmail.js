const nodemailer = require('nodemailer');
const User = require('../models/User');

const formatDay = date => date.toISOString().slice(0, 10);

// Never rejects: a failed email is only logged, and server.js shuts down on an unhandled rejection
async function sendOfferEmail(booking, campground) {
    try {
        const user = await User.findById(booking.user);
        const holdMinutes = parseFloat(process.env.OFFER_HOLD_MINUTES) || 1440;
        const deadline = new Date(booking.offeredAt.getTime() + holdMinutes * 60 * 1000);

        // Read config on each send: server.js loads the routes, and so this file, before dotenv runs
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: { name: process.env.FROM_NAME, address: process.env.FROM_EMAIL },
            to: user.email,
            subject: `A Spot opened up at ${campground.name}`,
            text: [
                `Hi ${user.name},`,
                '',
                'A Spot opened up for your Booking on the Waitlist. It is being held for you until the claim deadline.',
                '',
                `Campground: ${campground.name}`,
                `Check-in: ${formatDay(booking.checkInDate)}`,
                `Check-out: ${formatDay(booking.checkOutDate)}`,
                `Claim by: ${deadline.toUTCString()}`,
                `Booking id: ${booking._id}`,
                '',
                `To claim it, send PUT /api/v1/bookings/${booking._id}/confirm before the deadline.`
            ].join('\n')
        });

        // Only Ethereal gives a preview link
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`Offer email preview for Booking ${booking._id}: ${previewUrl}`);
        }
    } catch (err) {
        // A refused connection can arrive as an AggregateError with an empty message
        console.log(`Offer email for Booking ${booking._id} failed: ${err.message || err.code}`);
    }
}

module.exports = { sendOfferEmail };
