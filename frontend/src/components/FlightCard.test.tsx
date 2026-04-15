import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlightCard, FlightCardSkeleton } from './FlightCard';
import type { FlightOption, WeatherSummary } from '@fast-travel/shared';

const BASE_FLIGHT: FlightOption = {
  flightId: 'FL001',
  originIata: 'LHR',
  originCity: 'London',
  destinationIata: 'LIS',
  destinationCity: 'Lisbon',
  destinationCountry: 'Portugal',
  destinationLat: 38.77,
  destinationLng: -9.13,
  departureDatetime: '2026-04-10T08:00:00',
  arrivalDatetime: '2026-04-10T10:30:00',
  durationMinutes: 150,
  airlineName: 'TAP Portugal',
  stops: 0,
  priceUsd: 85,
  bookingUrl: 'https://example.com/book',
};

describe('FlightCard', () => {
  it('renders destination city', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('Lisbon')).toBeInTheDocument();
  });

  it('renders destination IATA code', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('LIS')).toBeInTheDocument();
  });

  it('renders price', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('$85')).toBeInTheDocument();
  });

  it('renders airline name', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('TAP Portugal')).toBeInTheDocument();
  });

  it('shows Direct badge for stops=0', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('Direct')).toBeInTheDocument();
  });

  it('shows stops badge for stops > 0', () => {
    const flight = { ...BASE_FLIGHT, stops: 1 };
    render(<FlightCard flight={flight} onSelect={vi.fn()} />);
    expect(screen.getByText('1 stop')).toBeInTheDocument();
  });

  it('shows plural stops badge correctly', () => {
    const flight = { ...BASE_FLIGHT, stops: 2 };
    render(<FlightCard flight={flight} onSelect={vi.fn()} />);
    expect(screen.getByText('2 stops')).toBeInTheDocument();
  });

  it('calls onSelect with the flight when clicked', () => {
    const onSelect = vi.fn();
    render(<FlightCard flight={BASE_FLIGHT} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(BASE_FLIGHT);
  });

  it('renders departure and arrival times', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('10:30')).toBeInTheDocument();
  });

  it('renders duration', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText(/2h 30m/)).toBeInTheDocument();
  });

  it('renders weather when provided', () => {
    const weather: WeatherSummary = {
      condition: 'clear',
      temperatureC: 22,
      isForecast: true,
      date: '2026-04-10',
    };
    render(<FlightCard flight={BASE_FLIGHT} weather={weather} onSelect={vi.fn()} />);
    expect(screen.getByText('22°C')).toBeInTheDocument();
  });

  it('does not render weather section when omitted', () => {
    render(<FlightCard flight={BASE_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.queryByText('°C')).not.toBeInTheDocument();
  });
});

describe('FlightCardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<FlightCardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
