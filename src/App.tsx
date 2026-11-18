import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowDownRight,
  Check,
  Minus,
  Moon,
  Plus,
  ShoppingBag,
  Sun,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  CATALOG_PRODUCTS,
  formatInr,
  GOJO_EDITIONS,
  GOJO_HERO_IMAGE,
  GOJO_MACRO_IMAGE,
  GOJO_SCALES,
  GOJO_WIDE_IMAGE,
  MERCHANT_UPI_VPA,
  SHOWCASE_STAGES,
  type CatalogFilter,
  type CatalogProduct,
} from './data/catalog';
import type { BagItem, CollectorOrder, UserProfile } from './types';
import { AccountModal } from './components/AccountModal';
import { CheckoutModal } from './components/CheckoutModal';
import { initHeroCanvas } from './webgl/heroCanvas';

gsap.registerPlugin(ScrollTrigger);

const GUEST_BAG_KEY = 'kurogane_guest_bag_v1';

function buildSafeItemId(productId: string, variantId: string): string {
  return `${productId}__${variantId}`
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Auth & Firestore User State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<CollectorOrder[]>([]);

  // Storefront Interactive State
  const [gojoEditionId, setGojoEditionId] = useState<string>(GOJO_EDITIONS[0].id);
  const [gojoScaleId, setGojoScaleId] = useState<string>(GOJO_SCALES[0].id);
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of CATALOG_PRODUCTS) {
      initial[p.id] = p.variants[0].id;
    }
    return initial;
  });
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Showcase & Comparison State
  const [activeStage, setActiveStage] = useState<number>(0);
  const [captionBlur, setCaptionBlur] = useState<boolean>(false);
  const [splitPct, setSplitPct] = useState<number>(50);
  const [splitAnimate, setSplitAnimate] = useState<boolean>(false);

  // Bag, Account & Checkout Modals
  const [bag, setBag] = useState<BagItem[]>(() => {
    try {
      const raw = localStorage.getItem(GUEST_BAG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BagItem[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore local storage parse errors
    }
    return [];
  });
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);

  // Refs for WebGL & GSAP
  const heroCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroStageRef = useRef<HTMLDivElement | null>(null);
  const tiltWrapRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const showcaseRef = useRef<HTMLElement | null>(null);
  const frameRefs = useRef<(HTMLElement | null)[]>([]);
  const catalogGridRef = useRef<HTMLDivElement | null>(null);
  const compWrapRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const stageIdxRef = useRef<number>(0);
  const stageTimerRef = useRef<number | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Persist guest bag locally when signed out
  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(GUEST_BAG_KEY, JSON.stringify(bag));
    } catch {
      // ignore storage errors
    }
  }, [bag, user]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore listeners (strictly gated on authReady && user)
  useEffect(() => {
    if (!authReady || !user) {
      setProfile(null);
      setOrders([]);
      return;
    }

    const userPath = `users/${user.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    const cartPath = `users/${user.uid}/cartItems`;
    const cartQuery = query(
      collection(db, 'users', user.uid, 'cartItems'),
      where('userId', '==', user.uid)
    );
    const unsubCart = onSnapshot(
      cartQuery,
      (snap) => {
        const items: BagItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            itemId: d.id,
            productId: String(data.productId || ''),
            title: String(data.title || ''),
            variant: String(data.variant || ''),
            image: String(data.image || ''),
            unitPriceInr: Number(data.unitPriceInr || 0),
            qty: Number(data.qty || 1),
          };
        });
        setBag(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, cartPath);
      }
    );

    const ordersQuery = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as CollectorOrder);
        list.sort((a, b) => {
          const ta = a.createdAt?.seconds ?? 0;
          const tb = b.createdAt?.seconds ?? 0;
          return tb - ta;
        });
        setOrders(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => {
      unsubProfile();
      unsubCart();
      unsubOrders();
    };
  }, [authReady, user]);

  // WebGL, Lenis, GSAP ScrollTrigger & 3D Tilt Effects
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const cleanupHeroGl = initHeroCanvas(heroCanvasRef.current);

    let lenis: InstanceType<typeof Lenis> | null = null;
    let lenisTicker: ((time: number) => void) | null = null;
    if (!prefersReduced) {
      lenis = new Lenis({
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
      lenisTicker = (time: number) => {
        lenis?.raf(time * 1000);
      };
      gsap.ticker.add(lenisTicker);
      gsap.ticker.lagSmoothing(0);
    }

    let targetRotX = 0;
    let targetRotY = 0;
    let curRotX = 0;
    let curRotY = 0;
    let velX = 0;
    let velY = 0;
    let tiltTicker: (() => void) | null = null;

    const heroStage = heroStageRef.current;
    const onHeroMove = (e: PointerEvent) => {
      if (!heroStage) return;
      const rect = heroStage.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetRotY = nx * 13;
      targetRotX = -ny * 9;
    };
    const onHeroLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    if (heroStage && tiltWrapRef.current && !prefersReduced) {
      heroStage.addEventListener('pointermove', onHeroMove);
      heroStage.addEventListener('pointerleave', onHeroLeave);
      tiltTicker = () => {
        const ax = (targetRotX - curRotX) * 0.08;
        const ay = (targetRotY - curRotY) * 0.08;
        velX = (velX + ax) * 0.82;
        velY = (velY + ay) * 0.82;
        curRotX += velX;
        curRotY += velY;
        if (tiltWrapRef.current) {
          tiltWrapRef.current.style.transform = `rotateX(${curRotX.toFixed(
            2
          )}deg) rotateY(${curRotY.toFixed(2)}deg)`;
        }
        if (shadowRef.current) {
          shadowRef.current.style.transform = `translateX(${(
            -curRotY * 1.4
          ).toFixed(1)}px) scale(${1 - Math.abs(curRotX) * 0.01})`;
        }
      };
      gsap.ticker.add(tiltTicker);
    }

    const gsapCtx = gsap.context(() => {
      if (prefersReduced) return;

      const frames = frameRefs.current.filter(
        (el): el is HTMLElement => el !== null
      );
      if (showcaseRef.current && frames.length === 4) {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: showcaseRef.current,
            start: 'top top',
            end: '+=280%',
            pin: true,
            scrub: 0.65,
            onUpdate: (self: { progress: number }) => {
              const t = self.progress * 3.5;
              let nextIdx = 0;
              if (t >= 3.07) nextIdx = 3;
              else if (t >= 2.02) nextIdx = 2;
              else if (t >= 0.97) nextIdx = 1;

              if (nextIdx !== stageIdxRef.current) {
                stageIdxRef.current = nextIdx;
                setCaptionBlur(true);
                if (stageTimerRef.current !== null) {
                  window.clearTimeout(stageTimerRef.current);
                }
                stageTimerRef.current = window.setTimeout(() => {
                  stageTimerRef.current = null;
                  setActiveStage(nextIdx);
                  setCaptionBlur(false);
                }, 100);
              }
            },
          },
        });

        const wipeStarts = [0.25, 1.3, 2.35];
        frames.forEach((frame, i) => {
          if (i === 0) return;
          tl.fromTo(
            frame,
            { clipPath: 'inset(0 0 0 100%)' },
            { clipPath: 'inset(0 0 0 0%)', ease: 'none', duration: 0.8 },
            wipeStarts[i - 1]
          );
        });
        tl.set({}, {}, 3.5);
      }

      if (catalogGridRef.current) {
        gsap.from('.reveal-card', {
          y: 24,
          opacity: 0,
          duration: 0.6,
          stagger: 0.07,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: catalogGridRef.current,
            start: 'top 85%',
            once: true,
          },
        });
      }
    });

    return () => {
      if (stageTimerRef.current !== null) {
        window.clearTimeout(stageTimerRef.current);
      }
      if (addedTimerRef.current !== null) {
        window.clearTimeout(addedTimerRef.current);
      }
      cleanupHeroGl();
      gsapCtx.revert();
      if (tiltTicker) gsap.ticker.remove(tiltTicker);
      if (lenisTicker) gsap.ticker.remove(lenisTicker);
      lenis?.destroy();
      heroStage?.removeEventListener('pointermove', onHeroMove);
      heroStage?.removeEventListener('pointerleave', onHeroLeave);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const signedInUser = credential.user;

      // Sync any guest cart items into Firestore
      const guestItems: BagItem[] = (() => {
        try {
          const raw = localStorage.getItem(GUEST_BAG_KEY);
          return raw ? (JSON.parse(raw) as BagItem[]) : [];
        } catch {
          return [];
        }
      })();

      if (guestItems.length > 0) {
        const batch = writeBatch(db);
        for (const item of guestItems) {
          const safeId = item.itemId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
          batch.set(
            doc(db, 'users', signedInUser.uid, 'cartItems', safeId),
            {
              userId: signedInUser.uid,
              productId: item.productId,
              title: item.title.slice(0, 140),
              variant: item.variant.slice(0, 120),
              image: item.image.slice(0, 300),
              unitPriceInr: item.unitPriceInr,
              qty: Math.min(20, Math.max(1, item.qty)),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
        await batch.commit();
        localStorage.removeItem(GUEST_BAG_KEY);
      }
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups for this site and retry.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Sign-in popup was closed before completing. Click again when ready.');
      } else {
        setAuthError('Unable to sign in right now. Please try again.');
      }
      console.error('Authentication error:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setBag([]);
    setAccountOpen(false);
  };

  const selectStage = (idx: number) => {
    stageIdxRef.current = idx;
    setCaptionBlur(true);
    if (stageTimerRef.current !== null) {
      window.clearTimeout(stageTimerRef.current);
    }
    stageTimerRef.current = window.setTimeout(() => {
      stageTimerRef.current = null;
      setActiveStage(idx);
      setCaptionBlur(false);
    }, 110);
    frameRefs.current.forEach((frame, i) => {
      if (!frame) return;
      frame.style.clipPath =
        i <= idx ? 'inset(0 0 0 0%)' : 'inset(0 0 0 100%)';
    });
  };

  const updateSplit = (pct: number, animate: boolean) => {
    const clamped = Math.max(0, Math.min(100, pct));
    setSplitAnimate(animate);
    setSplitPct(clamped);
  };

  const handleCompPointerDown = (e: {
    currentTarget: HTMLDivElement;
    pointerId: number;
    clientX: number;
  }) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    updateSplit(((e.clientX - rect.left) / rect.width) * 100, false);
  };

  const handleCompPointerMove = (e: {
    currentTarget: HTMLDivElement;
    clientX: number;
  }) => {
    if (!isDraggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    updateSplit(((e.clientX - rect.left) / rect.width) * 100, false);
  };

  const handleCompPointerUp = () => {
    isDraggingRef.current = false;
  };

  const addItemToBag = async (newItem: BagItem) => {
    setRecentlyAddedId(newItem.productId);
    if (addedTimerRef.current !== null) {
      window.clearTimeout(addedTimerRef.current);
    }
    addedTimerRef.current = window.setTimeout(() => {
      setRecentlyAddedId(null);
    }, 1400);

    if (user) {
      const existing = bag.find((item) => item.itemId === newItem.itemId);
      const nextQty = Math.min(20, (existing?.qty ?? 0) + newItem.qty);
      const path = `users/${user.uid}/cartItems/${newItem.itemId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'cartItems', newItem.itemId), {
          userId: user.uid,
          productId: newItem.productId,
          title: newItem.title.slice(0, 140),
          variant: newItem.variant.slice(0, 120),
          image: newItem.image.slice(0, 300),
          unitPriceInr: newItem.unitPriceInr,
          qty: nextQty,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } else {
      setBag((prev) => {
        const idx = prev.findIndex((item) => item.itemId === newItem.itemId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            qty: Math.min(20, next[idx].qty + newItem.qty),
          };
          return next;
        }
        return [...prev, newItem];
      });
    }
    setDrawerOpen(true);
  };

  const updateBagQty = async (item: BagItem, delta: number) => {
    const nextQty = item.qty + delta;
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'cartItems', item.itemId);
      const path = `users/${user.uid}/cartItems/${item.itemId}`;
      try {
        if (nextQty <= 0) {
          await deleteDoc(docRef);
        } else {
          await setDoc(
            docRef,
            {
              userId: user.uid,
              productId: item.productId,
              title: item.title.slice(0, 140),
              variant: item.variant.slice(0, 120),
              image: item.image.slice(0, 300),
              unitPriceInr: item.unitPriceInr,
              qty: Math.min(20, nextQty),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      setBag((prev) => {
        if (nextQty <= 0) {
          return prev.filter((x) => x.itemId !== item.itemId);
        }
        return prev.map((x) =>
          x.itemId === item.itemId ? { ...x, qty: Math.min(20, nextQty) } : x
        );
      });
    }
  };

  const activeGojoEdition =
    GOJO_EDITIONS.find((e) => e.id === gojoEditionId) ?? GOJO_EDITIONS[0];
  const activeGojoScale =
    GOJO_SCALES.find((s) => s.id === gojoScaleId) ?? GOJO_SCALES[0];
  const configuredGojoPrice =
    activeGojoEdition.priceInr + activeGojoScale.addonInr;

  const addConfiguredGojo = () => {
    const variantLabel = `${activeGojoEdition.name} · ${activeGojoScale.label}`;
    const itemId = buildSafeItemId(
      'gojo-domain-dx',
      `${activeGojoEdition.id}_${activeGojoScale.id}`
    );
    void addItemToBag({
      itemId,
      productId: 'gojo-domain-dx',
      title: 'Satoru Gojo — Domain Expansion',
      variant: variantLabel,
      image: GOJO_HERO_IMAGE,
      unitPriceInr: configuredGojoPrice,
      qty: 1,
    });
  };

  const addProductFromCatalog = (product: CatalogProduct) => {
    const variantId = selectedVariants[product.id] ?? product.variants[0].id;
    const variant =
      product.variants.find((v) => v.id === variantId) ?? product.variants[0];
    const itemId = buildSafeItemId(product.id, variant.id);
    void addItemToBag({
      itemId,
      productId: product.id,
      title: product.title,
      variant: variant.label,
      image: product.image,
      unitPriceInr: variant.priceInr,
      qty: 1,
    });
  };

  const filteredProducts = useMemo(() => {
    if (catalogFilter === 'all') return CATALOG_PRODUCTS;
    if (catalogFilter === 'museum') {
      return CATALOG_PRODUCTS.filter((p) => p.tier === 'museum');
    }
    return CATALOG_PRODUCTS.filter((p) => p.category === catalogFilter);
  }, [catalogFilter]);

  const totalQty = bag.reduce((sum, item) => sum + item.qty, 0);
  const totalInr = bag.reduce(
    (sum, item) => sum + item.unitPriceInr * item.qty,
    0
  );

  const accountLabel = user
    ? (profile?.displayName || user.displayName || 'Account').split(' ')[0]
    : 'Account';

  return (
    <>
      <div className="grain-overlay" aria-hidden="true" />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="site-header" id="site-header">
        <div className="container header-inner">
          <a href="#hero" className="brand-lockup" aria-label="Kurogane Collectibles Home">
            Kurogane
          </a>

          <nav className="header-nav" aria-label="Primary">
            <a href="#showcase" className="nav-link">
              Showcase
            </a>
            <a href="#compare" className="nav-link">
              Compare
            </a>
            <a href="#order" className="nav-link">
              Configure
            </a>
            <a href="#catalog" className="nav-link">
              Catalog
            </a>
            <button
              type="button"
              className="nav-link nav-btn-link"
              onClick={() => setAccountOpen(true)}
            >
              <UserIcon size={15} aria-hidden="true" />
              <span>{accountLabel}</span>
            </button>
          </nav>

          <div className="header-action-zone">
            <button
              type="button"
              className="btn btn-primary btn-sm bag-cta-btn"
              id="bag-trigger"
              aria-label="Open order bag"
              onClick={() => setDrawerOpen(true)}
            >
              <ShoppingBag size={15} aria-hidden="true" />
              <span className="tabular-nums">Bag ({totalQty})</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* SECTION 1: Cinematic Asymmetric Split Hero */}
        <section id="hero" className="hero">
          <canvas
            ref={heroCanvasRef}
            id="hero-gl-canvas"
            className="hero-canvas"
            aria-hidden="true"
          />

          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span>Jujutsu Kaisen</span>
                <span aria-hidden="true">·</span>
                <span>1/6 Scale Polystone</span>
                <span aria-hidden="true">·</span>
                <span>Direct UPI {MERCHANT_UPI_VPA}</span>
              </div>

              <h1 className="hero-title">Infinite Void, cast in stone.</h1>
              <p className="hero-sub">
                Museum-grade 1/4 and 1/6 scale Satoru Gojo, Berserk, One Piece,
                and Solo Leveling polystone statues, hand-painted with translucent
                resin and shipped across India.
              </p>

              <div className="hero-actions">
                <a href="#order" className="btn btn-primary">
                  Configure Gojo — {formatInr(configuredGojoPrice)}
                </a>
                <a href="#catalog" className="btn btn-ghost">
                  Explore Archive
                  <ArrowDownRight size={17} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Toggle light or dark gallery theme"
                  title="Switch Obsidian Dark or Gallery Light"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </button>
              </div>
            </div>

            <div className="hero-stage" ref={heroStageRef} id="hero-stage">
              <div
                className={`figure-aura ${activeGojoEdition.glowClass}`}
                aria-hidden="true"
              />
              <div
                className="flask-tilt-wrap"
                ref={tiltWrapRef}
                id="flask-tilt-wrap"
              >
                <div className="hero-statue-frame">
                  <img
                    src={GOJO_HERO_IMAGE}
                    alt="1/6 scale Satoru Gojo Domain Expansion collector statue with translucent blue-violet cursed energy"
                    className="statue-hero-img"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <div className="flask-shadow" ref={shadowRef} aria-hidden="true" />

              <div
                className="hero-swatches"
                role="radiogroup"
                aria-label="Select Satoru Gojo edition"
              >
                {GOJO_EDITIONS.map((ed) => {
                  const isActive = gojoEditionId === ed.id;
                  return (
                    <button
                      key={ed.id}
                      type="button"
                      role="radio"
                      className={`swatch-btn${isActive ? ' is-active' : ''}`}
                      aria-checked={isActive}
                      onClick={() => setGojoEditionId(ed.id)}
                    >
                      <span
                        className="swatch-dot"
                        style={{ background: ed.dot }}
                      />
                      <span className="swatch-label">{ed.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Pinned 4-Angle Cinematic Widescreen Showcase */}
        <section id="showcase" ref={showcaseRef} className="showcase-pin">
          <div className="showcase-viewport" id="showcase-viewport">
            <div className="showcase-frames" id="showcase-frames">
              {SHOWCASE_STAGES.map((stage, i) => (
                <figure
                  key={stage.title}
                  ref={(el: HTMLElement | null) => {
                    frameRefs.current[i] = el;
                  }}
                  className={`showcase-frame${i === 0 ? ' is-active' : ''}`}
                  data-index={i}
                >
                  <img
                    src={stage.src}
                    alt={stage.alt}
                    className="showcase-img"
                    referrerPolicy="no-referrer"
                  />
                </figure>
              ))}
            </div>

            <div className="showcase-hud">
              <div
                className={`showcase-caption${captionBlur ? ' is-blurring' : ''}`}
                id="showcase-caption"
              >
                <h2 className="caption-title" id="caption-title">
                  {SHOWCASE_STAGES[activeStage].title}
                </h2>
                <p className="caption-sub" id="caption-sub">
                  {SHOWCASE_STAGES[activeStage].sub}
                </p>
              </div>

              <div
                className="showcase-dots"
                role="tablist"
                aria-label="Showcase chapters"
              >
                {SHOWCASE_STAGES.map((stage, i) => (
                  <button
                    key={stage.title}
                    type="button"
                    role="tab"
                    aria-selected={activeStage === i}
                    className={`stage-dot${activeStage === i ? ' is-active' : ''}`}
                    aria-label={`Scene ${i + 1}`}
                    onClick={() => selectStage(i)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Interactive Sculpt & Lighting Comparison Slider */}
        <section id="compare" className="thermal-section">
          <div className="container thermal-grid">
            <div
              className="comparison-wrap"
              ref={compWrapRef}
              id="comparison-wrap"
              onPointerDown={handleCompPointerDown}
              onPointerMove={handleCompPointerMove}
              onPointerUp={handleCompPointerUp}
              onPointerCancel={handleCompPointerUp}
            >
              <div className="comparison-layer">
                <img
                  src={GOJO_MACRO_IMAGE}
                  alt="Hollow Purple translucent crystal sphere macro sculpt detail"
                  className="comparison-img"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div
                className="comparison-layer comparison-cold"
                id="comparison-cold"
                style={{
                  clipPath: `inset(0 ${100 - splitPct}% 0 0)`,
                  transition: splitAnimate
                    ? 'clip-path 380ms var(--ease-out)'
                    : 'none',
                }}
              >
                <img
                  src={GOJO_WIDE_IMAGE}
                  alt="Satoru Gojo full gallery plinth installation in volumetric rim light"
                  className="comparison-img"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div
                className={`comparison-handle${
                  splitPct <= 2 || splitPct >= 98 ? ' is-edge' : ''
                }`}
                id="comparison-handle"
                role="slider"
                tabIndex={0}
                aria-label="Compare Gallery Plinth and Hollow Purple Sculpt"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(splitPct)}
                style={{
                  left: `clamp(22px, ${splitPct}%, calc(100% - 22px))`,
                  transition: splitAnimate
                    ? 'left 380ms var(--ease-out)'
                    : 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') updateSplit(splitPct - 8, true);
                  if (e.key === 'ArrowRight') updateSplit(splitPct + 8, true);
                }}
              >
                <div className="handle-line" />
                <div className="handle-knob">
                  <span aria-hidden="true">↔</span>
                </div>
              </div>
            </div>

            <div className="thermal-copy">
              <h2 className="section-title">Sculpted for cinema light.</h2>
              <p className="section-sub">
                Every Gojo Satoru edition pairs matte-textured sorcerer tailoring
                with optical-grade translucent resin that catches ambient shelf
                and UV lighting without harsh plastic glare.
              </p>

              <div
                className="segmented-control"
                role="tablist"
                aria-label="Comparison view"
              >
                <button
                  type="button"
                  role="tab"
                  className={`seg-btn${splitPct >= 98 ? ' is-active' : ''}`}
                  aria-selected={splitPct >= 98}
                  onClick={() => updateSplit(100, true)}
                >
                  Gallery Plinth
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`seg-btn${splitPct <= 2 ? ' is-active' : ''}`}
                  aria-selected={splitPct <= 2}
                  onClick={() => updateSplit(0, true)}
                >
                  Hollow Purple Macro
                </button>
              </div>

              <div className="thermal-metrics">
                <div className="metric-item">
                  <span className="metric-value tabular-nums">1/6</span>
                  <span className="metric-label">Collector Scale</span>
                </div>
                <div className="metric-item">
                  <span className="metric-value tabular-nums">40 cm</span>
                  <span className="metric-label">Plinth DX Height</span>
                </div>
                <div className="metric-item">
                  <span className="metric-value tabular-nums">500</span>
                  <span className="metric-label">Numbered Run</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Interactive Gojo Configurator + Full Collector Archive */}
        <section id="order" className="order-section">
          <div className="container order-grid">
            <div className="order-preview" id="order-preview">
              <div
                className={`figure-aura ${activeGojoEdition.glowClass}`}
                aria-hidden="true"
              />
              <img
                src={GOJO_HERO_IMAGE}
                alt="Configured Satoru Gojo 1/6 scale resin statue"
                className="order-statue-img"
                referrerPolicy="no-referrer"
                style={{ transform: `scale(${activeGojoScale.scale})` }}
              />
            </div>

            <div className="order-panel">
              <div className="card-kicker">
                <span>Flagship Release</span>
                <span aria-hidden="true">·</span>
                <span>Jujutsu Kaisen</span>
                <span aria-hidden="true">·</span>
                <span>In Stock</span>
              </div>
              <h2 className="section-title">Satoru Gojo — Domain Expansion</h2>
              <p className="order-price tabular-nums" id="order-price">
                {formatInr(configuredGojoPrice)}
              </p>
              <p className="config-desc">{activeGojoEdition.summary}</p>

              <div className="config-group">
                <span className="config-label">Edition</span>
                <div className="option-row">
                  {GOJO_EDITIONS.map((ed) => (
                    <button
                      key={ed.id}
                      type="button"
                      className={`pill-option${
                        gojoEditionId === ed.id ? ' is-active' : ''
                      }`}
                      onClick={() => setGojoEditionId(ed.id)}
                    >
                      <span className="dot" style={{ background: ed.dot }} />
                      <span>{ed.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="config-group">
                <span className="config-label">Scale &amp; Base</span>
                <div className="option-row">
                  {GOJO_SCALES.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      className={`pill-option${
                        gojoScaleId === sc.id ? ' is-active' : ''
                      }`}
                      onClick={() => setGojoScaleId(sc.id)}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="spec-list">
                <div className="spec-row">
                  <span className="spec-key">Material</span>
                  <span className="spec-val">Polystone &amp; Translucent Resin</span>
                </div>
                <div className="spec-row">
                  <span className="spec-key">Authentication</span>
                  <span className="spec-val">Engraved Metal Plaque + Certificate</span>
                </div>
                <div className="spec-row">
                  <span className="spec-key">Payment</span>
                  <span className="spec-val tabular-nums">
                    Direct UPI ({MERCHANT_UPI_VPA})
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-full"
                id="add-to-bag-btn"
                onClick={addConfiguredGojo}
              >
                {recentlyAddedId === 'gojo-domain-dx' ? (
                  <>
                    <Check size={17} /> Added to Bag
                  </>
                ) : (
                  `Add to Bag — ${formatInr(configuredGojoPrice)}`
                )}
              </button>
            </div>
          </div>

          {/* Buy More Things: Full Collector Catalog */}
          <div id="catalog" className="container catalog-block">
            <div className="catalog-head">
              <div>
                <h2 className="section-title">Collector Archive</h2>
                <p className="section-sub">
                  Curated 1/4 museum statues and 1/6 scale anime editions. Combine
                  multiple collectibles in one bag and settle via UPI.
                </p>
              </div>

              <div
                className="segmented-control"
                role="tablist"
                aria-label="Filter collectibles"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogFilter === 'all'}
                  className={`seg-btn${catalogFilter === 'all' ? ' is-active' : ''}`}
                  onClick={() => setCatalogFilter('all')}
                >
                  All ({CATALOG_PRODUCTS.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogFilter === 'jjk'}
                  className={`seg-btn${catalogFilter === 'jjk' ? ' is-active' : ''}`}
                  onClick={() => setCatalogFilter('jjk')}
                >
                  Jujutsu Kaisen
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogFilter === 'icons'}
                  className={`seg-btn${catalogFilter === 'icons' ? ' is-active' : ''}`}
                  onClick={() => setCatalogFilter('icons')}
                >
                  Anime Icons
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogFilter === 'museum'}
                  className={`seg-btn${catalogFilter === 'museum' ? ' is-active' : ''}`}
                  onClick={() => setCatalogFilter('museum')}
                >
                  Museum Tier
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogFilter === 'gear'}
                  className={`seg-btn${catalogFilter === 'gear' ? ' is-active' : ''}`}
                  onClick={() => setCatalogFilter('gear')}
                >
                  Studio Gear
                </button>
              </div>
            </div>

            <div className="catalog-grid" ref={catalogGridRef}>
              {filteredProducts.map((product) => {
                const activeVarId =
                  selectedVariants[product.id] ?? product.variants[0].id;
                const activeVariant =
                  product.variants.find((v) => v.id === activeVarId) ??
                  product.variants[0];
                const isAdded = recentlyAddedId === product.id;

                return (
                  <article key={product.id} className="product-card reveal-card">
                    <div className="product-media-wrap">
                      <img
                        src={product.image}
                        alt={product.title}
                        className={`product-card-img${
                          product.category === 'gear' ? ' is-contain' : ''
                        }`}
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="product-card-body">
                      <div className="card-kicker">
                        <span>{product.series}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.scaleOrSpec}</span>
                      </div>

                      <h3 className="product-card-title">{product.title}</h3>
                      <p className="product-card-desc">{product.description}</p>

                      <div
                        className="card-variants"
                        role="radiogroup"
                        aria-label={`${product.title} variants`}
                      >
                        {product.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            role="radio"
                            aria-checked={activeVariant.id === v.id}
                            className={`variant-chip${
                              activeVariant.id === v.id ? ' is-active' : ''
                            }`}
                            onClick={() =>
                              setSelectedVariants((prev) => ({
                                ...prev,
                                [product.id]: v.id,
                              }))
                            }
                          >
                            {v.swatchHex && (
                              <span
                                className="variant-dot"
                                style={{ background: v.swatchHex }}
                              />
                            )}
                            <span>{v.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="product-card-footer">
                        <div>
                          <div className="product-price tabular-nums">
                            {formatInr(activeVariant.priceInr)}
                          </div>
                          <div className="product-note">{product.editionNote}</div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => addProductFromCatalog(product)}
                        >
                          {isAdded ? (
                            <>
                              <Check size={15} /> Added
                            </>
                          ) : (
                            'Add to Bag'
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span className="footer-brand">Kurogane Collectibles</span>
          <span className="footer-tag">
            Direct UPI Settlement · {MERCHANT_UPI_VPA}
          </span>
          <span className="footer-copy">© 2026 Kurogane Studio</span>
        </div>
      </footer>

      {/* Slide-Over Order Bag Drawer */}
      <div
        className="drawer-backdrop"
        id="drawer-backdrop"
        hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className="bag-drawer"
        id="bag-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        hidden={!drawerOpen}
      >
        <div className="drawer-header">
          <h2 id="drawer-title" className="drawer-title">
            Collector Bag ({totalQty})
          </h2>
          <button
            type="button"
            className="icon-btn"
            id="drawer-close"
            aria-label="Close bag"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body" id="drawer-body">
          <div className="drawer-empty" id="drawer-empty" hidden={bag.length > 0}>
            <p>Your collector bag is empty.</p>
            <a
              href="#catalog"
              className="btn btn-primary btn-sm"
              onClick={() => setDrawerOpen(false)}
            >
              Browse Collectibles
            </a>
          </div>

          <div className="drawer-items" id="drawer-items" hidden={bag.length === 0}>
            {bag.map((item) => (
              <div key={item.itemId} className="bag-item">
                <img
                  src={item.image}
                  alt={item.title}
                  className="bag-item-thumb"
                  referrerPolicy="no-referrer"
                />
                <div className="bag-item-info">
                  <div className="bag-item-name">{item.title}</div>
                  <div className="bag-item-meta">
                    {item.variant} ·{' '}
                    <span className="tabular-nums">
                      {formatInr(item.unitPriceInr)}
                    </span>
                  </div>
                  <div className="bag-qty-row">
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label="Decrease quantity"
                      onClick={() => void updateBagQty(item, -1)}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="bag-qty tabular-nums">{item.qty}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label="Increase quantity"
                      disabled={item.qty >= 20}
                      onClick={() => void updateBagQty(item, 1)}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      type="button"
                      className="qty-remove-btn"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => void updateBagQty(item, -item.qty)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="drawer-footer" id="drawer-footer" hidden={bag.length === 0}>
          <div className="drawer-total-row">
            <span>Payable Total</span>
            <span className="drawer-total tabular-nums" id="drawer-total">
              {formatInr(totalInr)}
            </span>
          </div>
          <p className="drawer-upi-note">
            Real UPI payment to <strong>{MERCHANT_UPI_VPA}</strong>
          </p>
          <button
            type="button"
            className="btn btn-primary btn-full"
            id="checkout-btn"
            onClick={() => {
              setAuthError('');
              setDrawerOpen(false);
              setCheckoutOpen(true);
            }}
          >
            Pay via UPI ({MERCHANT_UPI_VPA})
          </button>
        </div>
      </aside>

      {/* Account Modal */}
      <AccountModal
        open={accountOpen}
        user={user}
        profile={profile}
        orders={orders}
        authLoading={authLoading}
        authError={authError}
        onClose={() => {
          setAuthError('');
          setAccountOpen(false);
        }}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Real UPI Checkout Modal */}
      <CheckoutModal
        open={checkoutOpen}
        user={user}
        profile={profile}
        bag={bag}
        authLoading={authLoading}
        authError={authError}
        onClose={() => {
          setAuthError('');
          setCheckoutOpen(false);
        }}
        onSignIn={handleSignIn}
        onOrderSuccess={() => {
          if (!user) setBag([]);
        }}
      />
    </>
  );
}
