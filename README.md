# Campground

Campground Booking REST API (2110503 SW Dev Practice term project).

## Setup

1. `npm install`
2. Copy `config/config.env.example` to `config/config.env` and fill in the values.

## Run

```
npm run dev
```

## Test

With the server running, run the Postman collection in `postman/` with Newman:

```
npm test
```

The collection creates its own users, so it can be run repeatedly against the same database.
