import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { AccountView } from '@/components/AccountView';
import { guestGuard } from '@/lib/auth';
import { getGuestByUser, listReservations, listServices, ordersForGuest, listRoomTypes } from '@/lib/hotel';
import { one } from '@/lib/db';
import { listReviews, recommendServices, reviewedReservations } from '@/lib/graph';
import { wishList } from '@/lib/cache';
import { isStaff } from '@/lib/format';

export const metadata: Metadata = { title: 'My stays' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const s = await guestGuard();
  if (isStaff(s.role)) redirect('/dashboard');
  const guest = await getGuestByUser(s.userId);
  if (!guest) redirect('/');

  const [reservations, orders, services, reviewed, myReviews, reco, wishRaw, types, ver] = await Promise.all([
    listReservations({ guestId: guest.guest_id, limit: 100 }),
    ordersForGuest(guest.guest_id),
    listServices(),
    reviewedReservations(guest.guest_id),
    listReviews({ guestId: guest.guest_id, limit: 50 }),
    recommendServices(guest.guest_id, 4),
    wishList(s.userId),
    listRoomTypes(),
    one<{ v: number }>('SELECT email_verified_at IS NOT NULL AS v FROM users WHERE user_id = ?', [s.userId]),
  ]);
  const wishlist = wishRaw.map((w) => ({ ...w, room: types.find((t) => t.type_id === w.typeId)! })).filter((w) => w.room);

  return (
    <>
      <SiteHeader solid />
      <main className="mx-auto max-w-7xl px-5 pb-28 pt-32 sm:px-8">
        <AccountView
          guest={{ name: guest.full_name, tier: guest.loyalty_tier, points: guest.loyalty_points, email: guest.email, verified: !!ver?.v }}
          types={types.map((t) => ({ type_id: t.type_id, name: t.name, base_price: t.base_price }))}
          reservations={reservations} orders={orders as never} services={services} reviewedIds={[...reviewed]}
          myReviews={myReviews} reco={reco} wishlist={wishlist as never}
        />
      </main>
      <Footer />
    </>
  );
}
