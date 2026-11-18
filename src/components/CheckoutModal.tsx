import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatInr, MERCHANT_NAME, MERCHANT_UPI_VPA } from '../data/catalog';
import type { BagItem, CollectorOrder, UserProfile } from '../types';

interface CheckoutModalProps {
  open: boolean;
  user: User | null;
  profile: UserProfile | null;
  bag: BagItem[];
  authLoading: boolean;
  authError: string;
  onClose: () => void;
  onSignIn: () => Promise<void>;
  onOrderSuccess: (order: CollectorOrder) => void;
}

export function CheckoutModal({
  open,
  user,
  profile,
  bag,
  authLoading,
  authError,
  onClose,
  onSignIn,
  onOrderSuccess,
}: CheckoutModalProps) {
  const [orderId, setOrderId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedVpa, setCopiedVpa] = useState(false);

  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPincode, setShippingPincode] = useState('');
  const [utrReference, setUtrReference] = useState('');
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<CollectorOrder | null>(null);

  const totalInr = useMemo(
    () => bag.reduce((sum, item) => sum + item.unitPriceInr * item.qty, 0),
    [bag]
  );
  const itemCount = useMemo(
    () => bag.reduce((sum, item) => sum + item.qty, 0),
    [bag]
  );

  useEffect(() => {
    if (!open) return;
    const generatedId = `KRC-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    setOrderId(generatedId);
    setConfirmedOrder(null);
    setErrorMsg('');
    setUtrReference('');
    setCopiedVpa(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setBuyerName(profile?.displayName || user?.displayName || '');
    setBuyerPhone(profile?.phone || '');
    setShippingAddress(profile?.address || '');
    setShippingCity(profile?.city || '');
    setShippingPincode(profile?.pincode || '');
  }, [open, profile, user]);

  const upiUri = useMemo(() => {
    if (!orderId || totalInr <= 0) return '';
    const params = new URLSearchParams({
      pa: MERCHANT_UPI_VPA,
      pn: MERCHANT_NAME,
      tr: orderId,
      tn: `Order ${orderId}`,
      am: totalInr.toFixed(2),
      cu: 'INR',
    });
    return `upi://pay?${params.toString()}`;
  }, [orderId, totalInr]);

  useEffect(() => {
    if (!upiUri || !open) return;
    let active = true;
    QRCode.toDataURL(upiUri, {
      width: 240,
      margin: 2,
      color: {
        dark: '#090B0E',
        light: '#F4F6F8',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [upiUri, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopyVpa = async () => {
    try {
      await navigator.clipboard.writeText(MERCHANT_UPI_VPA);
      setCopiedVpa(true);
      window.setTimeout(() => setCopiedVpa(false), 2000);
    } catch {
      setCopiedVpa(false);
    }
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      setErrorMsg('Please sign in or create your account first so we can bind this order receipt.');
      return;
    }
    if (bag.length === 0) {
      setErrorMsg('Your bag is empty.');
      return;
    }

    const cleanName = buyerName.trim().slice(0, 100);
    const cleanPhone = buyerPhone.trim();
    const cleanAddress = shippingAddress.trim().slice(0, 300);
    const cleanCity = shippingCity.trim().slice(0, 80);
    const cleanPincode = shippingPincode.trim();
    const cleanUtr = utrReference.trim().replace(/\s+/g, '');

    if (!cleanName) {
      setErrorMsg('Recipient full name is required.');
      return;
    }
    if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
      setErrorMsg('Enter a valid 10–15 digit phone number.');
      return;
    }
    if (cleanAddress.length < 5) {
      setErrorMsg('Enter a complete delivery street address.');
      return;
    }
    if (cleanCity.length < 2) {
      setErrorMsg('Enter your delivery city.');
      return;
    }
    if (!/^[0-9]{6}$/.test(cleanPincode)) {
      setErrorMsg('Enter a valid 6-digit PIN code.');
      return;
    }
    if (!/^[A-Za-z0-9]{10,24}$/.test(cleanUtr)) {
      setErrorMsg('Enter the real 10–24 character UPI UTR / Reference number from your UPI app.');
      return;
    }

    const itemsSummary = bag
      .map((item) => `${item.qty}x ${item.title} (${item.variant})`)
      .join(' · ')
      .slice(0, 1000);

    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', orderId);

      batch.set(orderRef, {
        orderId,
        userId: user.uid,
        buyerName: cleanName,
        buyerEmail: (user.email || '').slice(0, 150),
        buyerPhone: cleanPhone,
        shippingAddress: cleanAddress,
        shippingCity: cleanCity,
        shippingPincode: cleanPincode,
        paymentMethod: 'UPI_FAM',
        upiVpa: MERCHANT_UPI_VPA,
        utrReference: cleanUtr,
        totalInr,
        itemCount,
        itemsSummary,
        status: 'pending_verification',
        createdAt: serverTimestamp(),
      });

      for (const item of bag) {
        const safeItemId = item.itemId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
        const orderItemRef = doc(db, 'orders', orderId, 'items', safeItemId);
        batch.set(orderItemRef, {
          orderId,
          userId: user.uid,
          productId: item.productId,
          title: item.title.slice(0, 140),
          variant: item.variant.slice(0, 120),
          unitPriceInr: item.unitPriceInr,
          qty: item.qty,
        });

        const cartDocRef = doc(db, 'users', user.uid, 'cartItems', safeItemId);
        batch.delete(cartDocRef);
      }

      if (saveAddressToProfile) {
        const userRef = doc(db, 'users', user.uid);
        const existingSnap = await getDoc(userRef);
        const profilePayload: Record<string, unknown> = {
          uid: user.uid,
          displayName: cleanName,
          email: (user.email || '').slice(0, 150),
          phone: cleanPhone,
          address: cleanAddress,
          city: cleanCity,
          pincode: cleanPincode,
          updatedAt: serverTimestamp(),
        };
        if (!existingSnap.exists()) {
          profilePayload.createdAt = serverTimestamp();
        }
        batch.set(userRef, profilePayload, { merge: true });
      }

      await batch.commit();

      const receipt: CollectorOrder = {
        orderId,
        userId: user.uid,
        buyerName: cleanName,
        buyerEmail: user.email || '',
        buyerPhone: cleanPhone,
        shippingAddress: cleanAddress,
        shippingCity: cleanCity,
        shippingPincode: cleanPincode,
        paymentMethod: 'UPI_FAM',
        upiVpa: MERCHANT_UPI_VPA,
        utrReference: cleanUtr,
        totalInr,
        itemCount,
        itemsSummary,
        status: 'pending_verification',
      };
      setConfirmedOrder(receipt);
      onOrderSuccess(receipt);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
      } catch {
        setErrorMsg('Could not record your order. Please verify your UTR and shipping details.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="checkout-modal-title" className="modal-title">
              {confirmedOrder ? 'Order Recorded' : 'Direct UPI Checkout'}
            </h2>
            <p className="modal-sub">
              {confirmedOrder
                ? `Receipt ${confirmedOrder.orderId} · Payment to ${MERCHANT_UPI_VPA}`
                : `Pay directly via UPI to ${MERCHANT_UPI_VPA} · Real bank-to-bank settlement`}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close checkout"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {confirmedOrder ? (
          <div className="receipt-view">
            <div className="receipt-hero-icon">
              <CheckCircle2 size={36} />
            </div>
            <h3>Order {confirmedOrder.orderId} Submitted</h3>
            <p className="receipt-lead">
              Your UTR reference <strong>{confirmedOrder.utrReference}</strong> for{' '}
              <strong className="tabular-nums">{formatInr(confirmedOrder.totalInr)}</strong>{' '}
              paid to <strong>{MERCHANT_UPI_VPA}</strong> has been logged for verification.
            </p>

            <div className="receipt-summary-box">
              <div className="receipt-row">
                <span>Status</span>
                <strong>Awaiting Payment Verification</strong>
              </div>
              <div className="receipt-row">
                <span>Recipient</span>
                <strong>{confirmedOrder.buyerName}</strong>
              </div>
              <div className="receipt-row">
                <span>Destination</span>
                <strong>
                  {confirmedOrder.shippingAddress}, {confirmedOrder.shippingCity} -{' '}
                  {confirmedOrder.shippingPincode}
                </strong>
              </div>
              <div className="receipt-row">
                <span>Items</span>
                <strong>{confirmedOrder.itemsSummary}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={onClose}
            >
              Return to Storefront
            </button>
          </div>
        ) : (
          <div className="checkout-grid">
            {/* Left Column: UPI Payment QR & Deep Link */}
            <div className="upi-pay-panel">
              <div className="upi-amount-head">
                <span className="upi-caption">Exact Payable Total</span>
                <span className="upi-total tabular-nums">{formatInr(totalInr)}</span>
                <span className="upi-order-ref tabular-nums">Order Ref · {orderId}</span>
              </div>

              <div className="upi-qr-box">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Scan UPI QR to pay ${formatInr(totalInr)} to ${MERCHANT_UPI_VPA}`}
                    className="upi-qr-img"
                  />
                ) : (
                  <div className="upi-qr-fallback">Generating UPI QR...</div>
                )}
              </div>

              <div className="upi-vpa-bar">
                <div>
                  <div className="upi-vpa-label">UPI ID (FamPay / NPCI)</div>
                  <div className="upi-vpa-value tabular-nums">{MERCHANT_UPI_VPA}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handleCopyVpa()}
                >
                  {copiedVpa ? <Check size={14} /> : <Copy size={14} />}
                  {copiedVpa ? 'Copied' : 'Copy'}
                </button>
              </div>

              <a
                href={upiUri}
                className="btn btn-primary btn-full upi-intent-btn"
              >
                <Smartphone size={17} />
                Open UPI App to Pay {formatInr(totalInr)}
                <ExternalLink size={15} />
              </a>

              <div className="upi-steps-note">
                <p>
                  1. Scan the QR or tap <strong>Open UPI App</strong> to send{' '}
                  <strong className="tabular-nums">{formatInr(totalInr)}</strong> directly to{' '}
                  <strong>{MERCHANT_UPI_VPA}</strong>.
                </p>
                <p>
                  2. Copy the <strong>12-digit UTR / UPI Transaction ID</strong> from your
                  FamPay, GPay, PhonePe, or Paytm receipt and paste it on the right.
                </p>
              </div>
            </div>

            {/* Right Column: Account Gate + Shipping + UTR Submission */}
            <div className="checkout-form-panel">
              {!user ? (
                <div className="checkout-auth-prompt">
                  <Lock size={20} />
                  <h3>Create Account to Complete Order</h3>
                  <p>
                    Sign in with Google so your order receipt, shipping address, and UTR payment
                    proof are securely linked to your account.
                  </p>
                  {authError && <p className="form-error">{authError}</p>}
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    disabled={authLoading}
                    onClick={() => void onSignIn()}
                  >
                    {authLoading ? 'Connecting...' : 'Sign In / Create Account with Google'}
                  </button>
                </div>
              ) : (
                <form className="checkout-form" onSubmit={(e) => void handlePlaceOrder(e)}>
                  <div className="checkout-section-head">
                    <span>Shipping &amp; Payment Verification</span>
                    <span className="checkout-account-email">{user.email}</span>
                  </div>

                  <div className="form-grid">
                    <label className="field-label">
                      <span>Full Name</span>
                      <input
                        type="text"
                        className="field-input"
                        required
                        maxLength={100}
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Recipient name"
                      />
                    </label>
                    <label className="field-label">
                      <span>Mobile Number</span>
                      <input
                        type="tel"
                        className="field-input"
                        required
                        maxLength={15}
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="10-digit mobile"
                      />
                    </label>
                  </div>

                  <label className="field-label">
                    <span>Street Address</span>
                    <input
                      type="text"
                      className="field-input"
                      required
                      maxLength={300}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Apartment, Street, Area"
                    />
                  </label>

                  <div className="form-grid">
                    <label className="field-label">
                      <span>City</span>
                      <input
                        type="text"
                        className="field-input"
                        required
                        maxLength={80}
                        value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)}
                        placeholder="City"
                      />
                    </label>
                    <label className="field-label">
                      <span>PIN Code</span>
                      <input
                        type="text"
                        className="field-input tabular-nums"
                        required
                        maxLength={6}
                        value={shippingPincode}
                        onChange={(e) => setShippingPincode(e.target.value.replace(/\D/g, ''))}
                        placeholder="6-digit PIN"
                      />
                    </label>
                  </div>

                  <label className="field-label utr-field">
                    <span>UPI Transaction ID / 12-Digit UTR Reference</span>
                    <input
                      type="text"
                      className="field-input tabular-nums"
                      required
                      minLength={10}
                      maxLength={24}
                      value={utrReference}
                      onChange={(e) =>
                        setUtrReference(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))
                      }
                      placeholder="e.g. 432819405812"
                    />
                  </label>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={saveAddressToProfile}
                      onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                    />
                    <span>Save shipping address to my Collector Account</span>
                  </label>

                  {errorMsg && <p className="form-error">{errorMsg}</p>}

                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={submitting}
                  >
                    <ShieldCheck size={17} />
                    {submitting
                      ? 'Recording Payment Proof...'
                      : `Submit UTR & Place Order (${formatInr(totalInr)})`}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
