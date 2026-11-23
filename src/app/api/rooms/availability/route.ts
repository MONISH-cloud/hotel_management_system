import { route, ApiError } from '@/lib/api';
import { listRoomTypes, availabilityByType } from '@/lib/hotel';
import { nightsBetween } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const checkIn = sp.get('checkIn') ?? '', checkOut = sp.get('checkOut') ?? '';
  const adults = Number(sp.get('adults') ?? 2), children = Number(sp.get('children') ?? 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) throw new ApiError(422, 'checkIn and checkOut must be YYYY-MM-DD');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new ApiError(422, 'Check-out must be after check-in');
  const [types, free, cfg] = await Promise.all([listRoomTypes(), availabilityByType(checkIn, checkOut), getSettings()]);
  const rate = cfg.tax_rate_pct / 100;
  return {
    nights,
    rooms: types
      .filter((t) => t.max_adults >= adults && t.max_children >= children)
      .map((t) => ({ ...t, available: free[t.type_id] ?? 0, subtotal: t.base_price * nights, tax: Math.round(t.base_price * nights * rate), total: Math.round(t.base_price * nights * (1 + rate)) })),
  };
});
