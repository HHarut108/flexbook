import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReturnFlightCard, ReturnFlightCardSkeleton } from './ReturnFlightCard';
import type { FlightOption } from '@fast-travel/shared';

const DIRECT_FLIGHT: FlightOption = {
  flightId: 'FL-RET-01',
  originIata: 'LIS',
  originCity: 'Lisbon',
  destinationIata: 'LHR',
  destinationCity: 'London',
  destinationCountry: 'United Kingdom',
  destinationLat: 51.48,
  destinationLng: -0.46,
  departureDatetime: '2026-04-15T14:00:00',
  arrivalDatetime: '2026-04-15T16:20:00',
  durationMinutes: 140,
  airlineName: 'TAP Portugal',
  stops: 0,
  priceUsd: 92,
  bookingUrl: 'https://example.com/book-return',
};

const VIA_FLIGHT: FlightOption = {
  ...DIRECT_FLIGHT,
  flightId: 'FL-RET-02',
  stops: 1,
  viaIatas: ['MAD'],
  durationMinutes: 220,
};

describe('ReturnFlightCard', () => {
  it('renders airline name', () => {
    render(<ReturnFlightCard flight={DIRECT_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('TAP Portugal')).toBeInTheDocument();
  });

  it('renders price', () => {
    render(<ReturnFlightCard flight={DIRECT_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('$92')).toBeInTheDocument();
  });

  it('shows Non-stop badge for direct flight', () => {
    render(<ReturnFlightCard flight={DIRECT_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('Non-stop')).toBeInTheDocument();
  });

  it('shows stop count badge for connecting flight', () => {
    render(<ReturnFlightCard flight={VIA_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('1 stop')).toBeInTheDocument();
  });

  it('shows origin and destination IATA in route for direct', () => {
    render(<ReturnFlightCard flight={DIRECT_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('LIS')).toBeInTheDocument();
    expect(screen.getByText('LHR')).toBeInTheDocument();
  });

  it('shows via IATA in route for connecting flight', () => {
    render(<ReturnFlightCard flight={VIA_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('MAD')).toBeInTheDocument();
  });

  it('renders departure and arrival times', () => {
    render(<ReturnFlightCard flight={DIRECT_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('16:20')).toBeInTheDocument();
  });

  it('renders duration label', () => {
    render(<ReturnFlightCard flight={DIRECT_FLIGHT} onSelect={vi.fn()} />);
    expect(screen.getByText('2h 20m')).toBeInTheDocument();
  });

  it('calls onSelect with the flight when clicked', () => {
    const onSelect = vi.fn();
    render(<ReturnFlightCard flight={DIRECT_FLIGHT} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(DIRECT_FLIGHT);
  });
});

describe('ReturnFlightCardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ReturnFlightCardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
