import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TripTimeline } from './TripTimeline';
import type { TripLeg } from '@fast-travel/shared';

function makeLeg(overrides: Partial<TripLeg> = {}): TripLeg {
  return {
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
    airlineName: 'TAP',
    stops: 0,
    priceUsd: 85,
    bookingUrl: 'https://example.com',
    stopIndex: 1,
    stayDurationDays: 3,
    nextDepartureDate: '2026-04-13',
    isReturn: false,
    ...overrides,
  };
}

describe('TripTimeline', () => {
  it('renders nothing when legs array is empty', () => {
    const { container } = render(<TripTimeline legs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when only return legs are provided', () => {
    const { container } = render(
      <TripTimeline legs={[makeLeg({ isReturn: true })]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one leg with correct IATA route', () => {
    render(<TripTimeline legs={[makeLeg()]} />);
    expect(screen.getByText('LHR → LIS')).toBeInTheDocument();
  });

  it('renders the stop index badge', () => {
    render(<TripTimeline legs={[makeLeg({ stopIndex: 1 })]} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders price for a leg', () => {
    render(<TripTimeline legs={[makeLeg({ priceUsd: 85 })]} />);
    expect(screen.getByText('$85')).toBeInTheDocument();
  });

  it('renders multiple outbound legs', () => {
    const legs = [
      makeLeg({ stopIndex: 1, originIata: 'LHR', destinationIata: 'LIS' }),
      makeLeg({ stopIndex: 2, originIata: 'LIS', destinationIata: 'MAD', priceUsd: 60 }),
    ];
    render(<TripTimeline legs={legs} />);
    expect(screen.getByText('LHR → LIS')).toBeInTheDocument();
    expect(screen.getByText('LIS → MAD')).toBeInTheDocument();
  });

  it('filters out return legs and only shows outbound', () => {
    const legs = [
      makeLeg({ stopIndex: 1, originIata: 'LHR', destinationIata: 'LIS' }),
      makeLeg({ stopIndex: 2, originIata: 'LIS', destinationIata: 'LHR', isReturn: true }),
    ];
    render(<TripTimeline legs={legs} />);
    expect(screen.getByText('LHR → LIS')).toBeInTheDocument();
    // The return leg route should not appear as a separate timeline entry
    expect(screen.queryAllByText('LIS → LHR')).toHaveLength(0);
  });

  it('shows date range when stayDurationDays > 0', () => {
    render(
      <TripTimeline
        legs={[makeLeg({ stayDurationDays: 3, nextDepartureDate: '2026-04-13', arrivalDatetime: '2026-04-10T10:30:00' })]}
      />,
    );
    // Should show "Apr 10 – Apr 13" or similar date range
    expect(screen.getByText(/Apr 10/)).toBeInTheDocument();
  });
});
