const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const helmet = require('helmet');
const {xss} = require('express-xss-sanitizer');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const connectDB = require('./config/db');
const { expireStale } = require('./utils/waitlist');

// Route files
const auth = require('./routes/auth.js');
const campgrounds = require('./routes/campground.js');
const bookings = require('./routes/booking.js');

// Load env vars
dotenv.config({path:'./config/config.env'});
// Connect to database
connectDB();

const app = express();

// Set query parser to extended (enables nested object parsing like capacity[gte]=4)
app.set('query parser', 'extended');

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(helmet());

// Prevent XSS attacks (passwords are hashed, never shown, so keep them as typed)
app.use(xss({allowedKeys: ['password']}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 mins
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000
});
app.use(limiter);

// Express 5 makes req.query a getter, so hpp cannot rewrite it without this
app.use((req, res, next) => {
    Object.defineProperty(req, 'query', {value: {...req.query}, writable: true});
    next();
});

// Prevent http param pollutions
app.use(hpp());

// Enable CORS
app.use(cors());

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/campgrounds', campgrounds);
app.use('/api/v1/bookings', bookings);

const PORT=process.env.PORT || 5000;

const server = app.listen(PORT, console.log('Server running in ', process.env.NODE_ENV, ' mode on port ', PORT));

// Catches missed QStash callbacks, and is the only Offer expiry without QSTASH_TOKEN
setInterval(expireStale, 10 * 1000);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);

    // Close server & exit process
    server.close(() => process.exit(1));
});
