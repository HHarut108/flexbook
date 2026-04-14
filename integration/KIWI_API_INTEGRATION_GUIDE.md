# 🚀 Blexbook × Kiwi.com Tequila API Integration Guide

**Version:** 1.0
**Date:** April 6, 2026
**Status:** Ready for Implementation

---

## 📋 Executive Summary

This document provides a comprehensive integration strategy for connecting **Blexbook** with the **Kiwi.com Tequila API** to deliver real-time direct flight search, pricing, and booking capabilities.

### Why Kiwi.com?
- ✅ All required data in **single API call**
- ✅ **Very Easy** integration difficulty
- ✅ Startup-friendly onboarding
- ✅ Direct/nonstop flight filtering built-in
- ✅ Competitive pricing data
- ✅ No additional APIs needed for MVP

---

## 🎯 Integration Objectives

### Phase 1: MVP (Weeks 1-4)
Deliver core flight search functionality with:
- [x] Nonstop flight filtering
- [x] Real-time pricing
- [x] Airline identification
- [x] Flight duration & arrival time
- [x] Basic search interface

### Phase 2: Enhancement (Weeks 5-8)
Add resilience and features:
- [ ] Skyscanner fallback integration
- [ ] Caching layer for performance
- [ ] Advanced filtering (price range, time windows)
- [ ] Booking flow integration

### Phase 3: Enterprise (Post-MVP)
Scale with:
- [ ] Amadeus API integration
- [ ] Multi-API aggregation
- [ ] White-label booking platform

---

## 🔌 API Overview

### Kiwi.com Tequila API

**Base URL:** `https://tequila-api.kiwi.com`

**Authentication:** API Key (query parameter)

**Rate Limits:**
- Free tier: 2 requests/second
- Production tier: Variable (contact sales)

**Response Format:** JSON

### Core Endpoint: Search Flights

```
GET /v2/search
```

**Required Parameters:**

| Parameter | Type | Example | Notes |
|-----------|------|---------|-------|
| `apikey` | string | `your_api_key_here` | Authentication |
| `fly_from` | string | `NYC` | IATA code (city or airport) |
| `fly_to` | string | `LON` | IATA code (city or airport) |
| `date_from` | string | `01/04/2026` | DD/MM/YYYY format |
| `date_to` | string | `05/04/2026` | DD/MM/YYYY format (optional) |
| `adults` | integer | `1` | Number of adult passengers |

**Optional Parameters for Filtering:**

| Parameter | Type | Example | Notes |
|-----------|------|---------|-------|
| `stopover` | integer | `0` | 0 = nonstop only (CRITICAL) |
| `max_stopover_duration` | integer | `0` | For stopover flights |
| `sort` | string | `price` | price, duration, date |
| `order` | string | `asc` | asc, desc |
| `limit` | integer | `50` | Results per page |
| `offset` | integer | `0` | Pagination |

### Example API Request

```bash
curl -X GET "https://tequila-api.kiwi.com/v2/search?apikey=YOUR_KEY&fly_from=NYC&fly_to=LON&date_from=01/04/2026&adults=1&stopover=0&sort=price"
```

### API Response Schema

```json
{
  "search_id": "abc123def456",
  "data": [
    {
      "id": "1234567890",
      "type": "flight",
      "fly_from": "NYC",
      "fly_to": "LON",
      "cityFrom": "New York",
      "cityTo": "London",
      "price": 249,
      "currency": "USD",
      "route": [
        {
          "id": "0",
          "combination_id": "0",
          "flyFrom": {
            "name": "John F. Kennedy International Airport",
            "code": "JFK"
          },
          "flyTo": {
            "name": "London Stansted Airport",
            "code": "STN"
          },
          "airline": "BA",
          "flight_no": "112",
          "operating_carrier": "BA",
          "utc_departure": "2026-04-01T11:00:00",
          "utc_arrival": "2026-04-01T23:30:00",
          "local_departure": "2026-04-01T11:00:00",
          "local_arrival": "2026-04-02T00:30:00",
          "duration": {
            "total": 33000,
            "flyingTime": 28800
          },
          "guarantee": false,
          "equipment": "777"
        }
      ],
      "deep_link": "https://www.kiwi.com/deep?...",
      "bags_price": {
        "1": 45,
        "2": 85
      },
      "availability": {
        "seats": 5
      }
    }
  ],
  "links": {
    "next": "/v2/search?...offset=50"
  },
  "all_airlines": ["BA", "AA"],
  "expires_in": 86400
}
```

---

## 🛠️ Backend Implementation

### Technology Stack

**Recommended:**
- Node.js + Express (or similar)
- Redis (caching)
- PostgreSQL (flight history, bookings)
- JWT authentication

### API Service Layer

#### File: `backend/services/flightService.js`

```javascript
const axios = require('axios');
const redis = require('redis');
const logger = require('../utils/logger');

const KIWI_API_BASE = 'https://tequila-api.kiwi.com/v2';
const KIWI_API_KEY = process.env.KIWI_API_KEY;
const CACHE_TTL = 3600; // 1 hour

class FlightService {
  constructor() {
    this.client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    });
  }

  /**
   * Search for direct flights
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array>} Flight results
   */
  async searchDirectFlights(searchParams) {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      children = 0,
    } = searchParams;

    // Validate inputs
    if (!origin || !destination || !departureDate) {
      throw new Error('Missing required parameters: origin, destination, departureDate');
    }

    // Generate cache key
    const cacheKey = `flights:${origin}:${destination}:${departureDate}:${adults}:${children}`;

    // Check cache
    try {
      const cached = await this.client.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for key: ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      logger.warn(`Cache error: ${cacheError.message}`);
    }

    // Build query parameters
    const queryParams = {
      apikey: KIWI_API_KEY,
      fly_from: origin,
      fly_to: destination,
      date_from: this.formatDate(departureDate),
      adults,
      stopover: 0, // CRITICAL: Direct flights only
      sort: 'price',
      limit: 50,
    };

    if (children > 0) queryParams.children = children;
    if (returnDate) queryParams.date_to = this.formatDate(returnDate);

    try {
      const response = await axios.get(`${KIWI_API_BASE}/search`, {
        params: queryParams,
        timeout: 5000,
      });

      const flights = this.formatFlights(response.data.data || []);

      // Cache results
      try {
        await this.client.setex(cacheKey, CACHE_TTL, JSON.stringify(flights));
      } catch (cacheError) {
        logger.warn(`Failed to cache results: ${cacheError.message}`);
      }

      return flights;
    } catch (error) {
      logger.error(`Kiwi API error: ${error.message}`);
      throw new Error(`Failed to fetch flights: ${error.message}`);
    }
  }

  /**
   * Format API response to internal schema
   * @param {Array} rawFlights - Raw API response
   * @returns {Array} Formatted flights
   */
  formatFlights(rawFlights) {
    return rawFlights.map((flight) => {
      const firstSegment = flight.route[0];
      const lastSegment = flight.route[flight.route.length - 1];

      return {
        id: flight.id,
        origin: flight.fly_from,
        destination: flight.fly_to,
        originCity: flight.cityFrom,
        destinationCity: flight.cityTo,
        price: flight.price,
        currency: flight.currency,
        airline: firstSegment.airline,
        flightNumber: firstSegment.flight_no,
        departure: new Date(firstSegment.local_departure),
        arrival: new Date(lastSegment.local_arrival),
        departureTime: firstSegment.local_departure.split('T')[1],
        arrivalTime: lastSegment.local_arrival.split('T')[1],
        duration: firstSegment.duration.total, // seconds
        durationHours: Math.floor(firstSegment.duration.total / 3600),
        durationMinutes: Math.floor((firstSegment.duration.total % 3600) / 60),
        stops: flight.route.length - 1,
        equipment: firstSegment.equipment,
        bookingLink: flight.deep_link,
        baggageOptions: flight.bags_price || {},
        seatsAvailable: flight.availability?.seats || null,
      };
    });
  }

  /**
   * Format date to DD/MM/YYYY
   * @param {String|Date} date - Input date
   * @returns {String} Formatted date
   */
  formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Get flight details by ID
   * @param {String} flightId - Flight ID from search results
   * @returns {Promise<Object>} Flight details
   */
  async getFlightDetails(flightId) {
    // Additional details can be fetched via booking endpoint
    // For MVP, return search result details
    const cacheKey = `flight:${flightId}`;
    try {
      const cached = await this.client.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      logger.warn(`Cache error: ${e.message}`);
    }
    // Return empty or fetch from booking confirmation
    return null;
  }
}

module.exports = new FlightService();
```

### API Endpoint

#### File: `backend/routes/flights.js`

```javascript
const express = require('express');
const router = express.Router();
const flightService = require('../services/flightService');
const { validateSearchParams } = require('../middleware/validation');

/**
 * POST /api/flights/search
 * Search for direct flights
 */
router.post('/search', validateSearchParams, async (req, res) => {
  try {
    const { origin, destination, departureDate, returnDate, adults, children } = req.body;

    const flights = await flightService.searchDirectFlights({
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      children,
    });

    return res.status(200).json({
      success: true,
      count: flights.length,
      data: flights,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/flights/:flightId
 * Get flight details
 */
router.get('/:flightId', async (req, res) => {
  try {
    const { flightId } = req.params;
    const flight = await flightService.getFlightDetails(flightId);

    if (!flight) {
      return res.status(404).json({
        success: false,
        error: 'Flight not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: flight,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
```

---

## 🎨 Frontend Integration

### React Component Example

#### File: `frontend/components/FlightSearch.jsx`

```jsx
import React, { useState } from 'react';
import axios from 'axios';
import './FlightSearch.css';

const FlightSearch = () => {
  const [searchParams, setSearchParams] = useState({
    origin: '',
    destination: '',
    departureDate: '',
    returnDate: '',
    adults: 1,
    children: 0,
  });

  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/flights/search', searchParams);
      setFlights(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed. Please try again.');
      setFlights([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flight-search">
      <h1>Find Direct Flights</h1>

      <form onSubmit={handleSearch}>
        <div className="form-row">
          <div className="form-group">
            <label>From (City/Airport)</label>
            <input
              type="text"
              name="origin"
              value={searchParams.origin}
              onChange={handleInputChange}
              placeholder="e.g., NYC, JFK"
              required
            />
          </div>

          <div className="form-group">
            <label>To (City/Airport)</label>
            <input
              type="text"
              name="destination"
              value={searchParams.destination}
              onChange={handleInputChange}
              placeholder="e.g., LON, LHR"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Departure Date</label>
            <input
              type="date"
              name="departureDate"
              value={searchParams.departureDate}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Return Date (Optional)</label>
            <input
              type="date"
              name="returnDate"
              value={searchParams.returnDate}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Adults</label>
            <select
              name="adults"
              value={searchParams.adults}
              onChange={handleInputChange}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Children</label>
            <select
              name="children"
              value={searchParams.children}
              onChange={handleInputChange}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search Flights'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {flights.length > 0 && (
        <div className="results">
          <h2>Available Flights ({flights.length})</h2>
          <table className="flights-table">
            <thead>
              <tr>
                <th>Airline</th>
                <th>Departure</th>
                <th>Arrival</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((flight) => (
                <tr key={flight.id}>
                  <td>{flight.airline}</td>
                  <td>{flight.departureTime}</td>
                  <td>{flight.arrivalTime}</td>
                  <td>
                    {flight.durationHours}h {flight.durationMinutes}m
                  </td>
                  <td>
                    ${flight.price} {flight.currency}
                  </td>
                  <td>
                    <a
                      href={flight.bookingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-book"
                    >
                      Book
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && flights.length === 0 && !error && (
        <p className="no-results">Search for flights to see results</p>
      )}
    </div>
  );
};

export default FlightSearch;
```

---

## 🔑 Configuration & Setup

### Environment Variables

#### File: `.env`

```bash
# Kiwi.com API
KIWI_API_KEY=your_api_key_here
KIWI_API_BASE=https://tequila-api.kiwi.com/v2

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blexbook
DB_USER=postgres
DB_PASSWORD=

# Application
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
```

### API Key Acquisition

1. **Register at Kiwi.com:**
   - Visit https://tequila.kiwi.com/
   - Click "Get API Key"
   - Complete sign-up

2. **Verify Email & Activate Account**

3. **Copy API Key to `.env`**

4. **Set Up Sandbox Testing:**
   - Use test parameters in documentation
   - Rate limit: 2 requests/sec (free tier)

### Dependencies Installation

```bash
# Backend
cd backend
npm install axios redis express dotenv

# Frontend
cd frontend
npm install axios react-router-dom
```

---

## 📊 Database Schema

### Flights Table (Caching)

```sql
CREATE TABLE flights (
  id SERIAL PRIMARY KEY,
  flight_id VARCHAR(255) UNIQUE NOT NULL,
  origin VARCHAR(10),
  destination VARCHAR(10),
  airline VARCHAR(10),
  departure TIMESTAMP,
  arrival TIMESTAMP,
  price DECIMAL(10, 2),
  currency VARCHAR(3),
  duration INTEGER,
  booking_link TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_origin_destination ON flights(origin, destination);
CREATE INDEX idx_departure ON flights(departure);
```

### Bookings Table

```sql
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  flight_id VARCHAR(255),
  confirmation_number VARCHAR(50),
  status ENUM('pending', 'confirmed', 'completed', 'cancelled'),
  passengers JSONB,
  total_price DECIMAL(10, 2),
  currency VARCHAR(3),
  booking_reference TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🧪 Testing Strategy

### Unit Tests

```javascript
// test/services/flightService.test.js
describe('FlightService', () => {
  it('should search for direct flights', async () => {
    const result = await flightService.searchDirectFlights({
      origin: 'NYC',
      destination: 'LON',
      departureDate: '2026-04-15',
      adults: 1,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('price');
    expect(result[0]).toHaveProperty('airline');
    expect(result[0].stops).toBe(0); // Direct flights
  });

  it('should cache results', async () => {
    const params = {
      origin: 'NYC',
      destination: 'LON',
      departureDate: '2026-04-15',
      adults: 1,
    };

    const result1 = await flightService.searchDirectFlights(params);
    const result2 = await flightService.searchDirectFlights(params);

    expect(result1).toEqual(result2);
  });
});
```

### Integration Tests

```javascript
// test/api/flights.integration.test.js
describe('GET /api/flights/search', () => {
  it('should return flights for valid search', async () => {
    const response = await request(app)
      .post('/api/flights/search')
      .send({
        origin: 'NYC',
        destination: 'LON',
        departureDate: '2026-04-15',
        adults: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

---

## 🚀 Deployment Checklist

- [ ] API key stored in secure environment
- [ ] Redis instance configured and running
- [ ] Database migrations executed
- [ ] Rate limiting implemented
- [ ] Error handling tested
- [ ] Cache TTL optimized
- [ ] CORS configured for frontend
- [ ] SSL/TLS enabled (HTTPS)
- [ ] Monitoring & logging set up
- [ ] Load testing completed
- [ ] Security audit passed

---

## 📈 Performance Optimization

### Caching Strategy

- **Search Results:** 1 hour (3600 seconds)
- **Flight Details:** 24 hours (86400 seconds)
- **IATA Codes:** 7 days (604800 seconds)

### Query Optimization

```javascript
// Bad: Multiple API calls
const flightA = await search({ ... });
const flightB = await search({ ... });

// Good: Batch parameters
const flights = await search({
  origins: ['NYC', 'BOS'],
  destinations: ['LON', 'PAR'],
  ...
});
```

---

## 🔒 Security Considerations

1. **API Key Protection:**
   - Store in environment variables
   - Never commit to version control
   - Rotate periodically

2. **Request Validation:**
   - Sanitize user inputs
   - Validate date formats
   - Limit request parameters

3. **Rate Limiting:**
   - Implement per-user rate limits
   - Use API gateway for throttling
   - Monitor suspicious activity

4. **Data Protection:**
   - Encrypt sensitive data in database
   - Use HTTPS for all communications
   - Implement CORS properly

---

## 📞 Support & Resources

### Kiwi.com Documentation
- **API Docs:** https://tequila.kiwi.com/
- **Endpoint Reference:** https://tequila.kiwi.com/documentation
- **Status Page:** https://status.kiwi.com/

### Troubleshooting

**Issue: 401 Unauthorized**
- Verify API key is correct
- Check API key hasn't expired
- Ensure key has appropriate permissions

**Issue: 400 Bad Request**
- Validate parameter format (dates must be DD/MM/YYYY)
- Ensure IATA codes are valid
- Check required fields are present

**Issue: Slow API Response**
- Implement client-side caching
- Use Redis for server-side caching
- Reduce search date ranges

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-06 | Initial integration guide |

---

## 📄 Appendix

### A. IATA Code Reference

Common city/airport codes:

| City | Code | Airports |
|------|------|----------|
| New York | NYC | JFK, LGA, EWR |
| London | LON | LHR, LGW, STN |
| Paris | PAR | CDG, ORY |
| Tokyo | TYO | NRT, HND |
| Sydney | SYD | SYD |

### B. Date Format Examples

- Input: `2026-04-15` → API: `15/04/2026`
- Input: `2026-12-25` → API: `25/12/2026`

### C. Booking Flow

1. User searches flights → API returns results
2. User selects flight → Display details
3. User clicks "Book" → Redirect to Kiwi deep link
4. User completes payment on Kiwi.com
5. Confirmation sent to user email
6. Booking stored in Blexbook database

---

**Document prepared by:** Integration Team
**Last updated:** April 6, 2026
**Next review:** May 6, 2026
