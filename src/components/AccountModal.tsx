import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Check, LogOut, Package, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatInr, MERCHANT_UPI_VPA } from '../data/catalog';
import type { CollectorOrder, UserProfile } from '../types';

interface AccountModalProps {
  open: boolean;
  user: User | null;
  profile: UserProfile | null;
  orders: CollectorOrder[];
  authLoading: boolean;
  authError: string;
  onClose: () => void;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AccountModal({
  open,
  user,
  profile,
  orders,
  authLoading,
  authError,
  onClose,
  onSignIn,
  onSignOut,
}: AccountModalProps) {
  const [tab, setTab] = useState<'profile' | 'orders'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile?.displayName || user?.displayName || '');
    setPhone(profile?.phone || '');
    setAddress(profile?.address || '');
    setCity(profile?.city || '');
    setPincode(profile?.pincode || '');
    setFormError('');
    setSavedNotice(false);
  }, [open, profile, user]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');
    setSavedNotice(false);

    const cleanName = displayName.trim().slice(0, 100);
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim().slice(0, 300);
    const cleanCity = city.trim().slice(0, 80);
    const cleanPincode = pincode.trim();

    if (!cleanName) {
      setFormError('Please enter your collector display name.');
      return;
    }
    if (cleanPhone && !/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
      setFormError('Phone number must be 10–15 digits.');
      return;
    }
    if (cleanAddress && cleanAddress.length < 5) {
      setFormError('Shipping address must be at least 5 characters.');
      return;
    }
    if (cleanCity && cleanCity.length < 2) {
      setFormError('City must be at least 2 characters.');
      return;
    }
    if (cleanPincode && !/^[0-9]{6}$/.test(cleanPincode)) {
      setFormError('PIN code must be exactly 6 digits.');
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const existingSnap = await getDoc(userRef);
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName: cleanName,
        email: (user.email || '').slice(0, 150),
        updatedAt: serverTimestamp(),
      };
      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }
      if (cleanPhone) payload.phone = cleanPhone;
      if (cleanAddress) payload.address = cleanAddress;
      if (cleanCity) payload.city = cleanCity;
      if (cleanPincode) payload.pincode = cleanPincode;

      await setDoc(userRef, payload, { merge: true });
      setSavedNotice(true);
    } catch (error) {
      try {
        handleFirestoreError(
          error,
          profile ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}`
        );
      } catch (wrapped) {
        setFormError(
          wrapped instanceof Error ? 'Unable to save profile. Please verify fields.' : 'Save failed.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="account-modal-title" className="modal-title">
              {user ? 'Collector Account' : 'Create Collector Account'}
            </h2>
            <p className="modal-sub">
              {user
                ? `${user.email} · Verified Account`
                : 'Sign in with Google to save your shipping profile, sync your bag, and track UPI orders.'}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close account modal"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {!user ? (
          <div className="account-auth-gate">
            <div className="account-perks">
              <div className="perk-row">
                <ShieldCheck size={18} />
                <span>Verified collector identity for numbered 1/6 scale editions</span>
              </div>
              <div className="perk-row">
                <Package size={18} />
                <span>Persistent bag &amp; live UPI UTR order receipt history</span>
              </div>
              <div className="perk-row">
                <UserIcon size={18} />
                <span>One-tap shipping address prefill during UPI checkout</span>
              </div>
            </div>

            {authError && <p className="form-error">{authError}</p>}

            <button
              type="button"
              className="btn btn-primary btn-full"
              disabled={authLoading}
              onClick={() => void onSignIn()}
            >
              {authLoading ? 'Connecting Account...' : 'Create Account / Sign In with Google'}
            </button>
          </div>
        ) : (
          <div className="account-body">
            <div className="segmented-control account-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'profile'}
                className={`seg-btn${tab === 'profile' ? ' is-active' : ''}`}
                onClick={() => setTab('profile')}
              >
                Shipping Profile
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'orders'}
                className={`seg-btn${tab === 'orders' ? ' is-active' : ''}`}
                onClick={() => setTab('orders')}
              >
                Orders ({orders.length})
              </button>
            </div>

            {tab === 'profile' ? (
              <form className="account-form" onSubmit={(e) => void handleSaveProfile(e)}>
                <div className="form-grid">
                  <label className="field-label">
                    <span>Full Name</span>
                    <input
                      type="text"
                      className="field-input"
                      value={displayName}
                      maxLength={100}
                      required
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Satoru Collector"
                    />
                  </label>
                  <label className="field-label">
                    <span>Mobile Number (India)</span>
                    <input
                      type="tel"
                      className="field-input"
                      value={phone}
                      maxLength={15}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                    />
                  </label>
                </div>

                <label className="field-label">
                  <span>Delivery Address</span>
                  <input
                    type="text"
                    className="field-input"
                    value={address}
                    maxLength={300}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House / Flat, Street, Landmark"
                  />
                </label>

                <div className="form-grid">
                  <label className="field-label">
                    <span>City</span>
                    <input
                      type="text"
                      className="field-input"
                      value={city}
                      maxLength={80}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Mumbai"
                    />
                  </label>
                  <label className="field-label">
                    <span>PIN Code</span>
                    <input
                      type="text"
                      className="field-input tabular-nums"
                      value={pincode}
                      maxLength={6}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="400001"
                    />
                  </label>
                </div>

                {formError && <p className="form-error">{formError}</p>}
                {savedNotice && (
                  <p className="form-success">
                    <Check size={15} /> Collector profile saved.
                  </p>
                )}

                <div className="account-footer-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void onSignOut()}
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="orders-list">
                {orders.length === 0 ? (
                  <div className="orders-empty">
                    <p>No orders placed yet.</p>
                    <p className="orders-empty-sub">
                      Add figures or gear to your bag and settle directly via UPI ({MERCHANT_UPI_VPA}).
                    </p>
                  </div>
                ) : (
                  orders.map((order) => {
                    const placedDate = order.createdAt?.seconds
                      ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Just now';

                    return (
                      <article key={order.orderId} className="order-history-card">
                        <div className="order-history-top">
                          <div>
                            <div className="order-id-text tabular-nums">{order.orderId}</div>
                            <div className="order-meta-line">
                              <span>{placedDate}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Paid to {order.upiVpa}</span>
                            </div>
                          </div>
                          <div className="order-amount-col">
                            <div className="order-total-text tabular-nums">
                              {formatInr(order.totalInr)}
                            </div>
                            <div className="order-status-text">Awaiting Verification</div>
                          </div>
                        </div>
                        <p className="order-summary-items">{order.itemsSummary}</p>
                        <div className="order-utr-row tabular-nums">
                          <span>UTR Ref: {order.utrReference}</span>
                          <span>
                            {order.shippingCity} · {order.shippingPincode}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
