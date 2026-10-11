/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Check,
  ShoppingBag,
  Users,
  PackageSearch,
  ArrowUp,
} from 'lucide-react';
import {
  createConsignor,
  createConsignmentItems,
  deleteConsignor,
  syncShopifyProduct,
  deleteConsignmentItem,
  getConsignmentData,
  recordConsignorPayout,
  updateConsignmentItem,
  updateConsignmentItemStatus,
  updateConsignor,
  importConsignmentData,
} from './consignmentApi';
import ReportsScreen from './pages/consignment/ReportsScreen';
import DashboardScreen from './pages/consignment/DashboardScreen';
import ItemsScreen from './pages/consignment/ItemsScreen';
import Header from './components/consignment/Header';
import ConsignorsScreen from './pages/consignment/ConsignorsScreen';
import SalesScreen from './pages/consignment/SalesScreen';
import PayoutsScreen from './pages/consignment/PayoutsScreen';
import PayoutReceiptScreen from './pages/consignment/PayoutReceiptScreen';
import ShopifyProductScreen from './pages/shopify/ShopifyProductScreen';
import ExistingProductMetaPostScreen from './pages/shopify/ExistingProductMetaPostScreen';
import ConsignorDashboard from './pages/consignment/ConsignorDashboard';
import ConsignorFormScreen from './pages/consignment/ConsignorFormScreen';
import './styles/consignment-global.css';
import './styles/consignment-forms.css';
import './styles/shopify-file-picker.css';
/* ============================================================================
   STYLING
   All app CSS is external. This intake file contains no embedded GlobalStyle().
   Shared app styles: ./styles/consignment-global.css
   Shared filter/search/view styles: ./styles/consignment-filter-bar.css
   ============================================================================ */
import { money } from './lib/consignmentHelpers';
import AppNavigation from './components/consignment/AppNavigation';
import { exportConsignors } from './lib/csv';
import ChooseConsignorScreen from './pages/consignment/ChooseConsignorScreen';
import CreatePayoutScreen from './pages/consignment/CreatePayoutScreen';
import EditItemScreen from './pages/consignment/EditItemScreen';
import ImportScreen from './pages/consignment/ImportScreen';
import IntakeScreen from './pages/consignment/IntakeScreen';

/* ---------- image helper ---------- */

/* ---------- small components ---------- */

/* ---------- screens ---------- */

export default function ConsignmentIntakeApp({ activePlan = null }) {
  const tier2Enabled = activePlan === 'TIER2';
  const [ready, setReady] = useState(false);
  const [consignors, setConsignors] = useState([]);
  const [items, setItems] = useState([]);
  const [shopCurrency, setShopCurrency] = useState('CAD');
  const [view, setView] = useState('dashboard');
  const [activeId, setActiveId] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [query, setQuery] = useState('');
  const [newConsignorNext, setNewConsignorNext] = useState('consignor');
  const [newConsignorBack, setNewConsignorBack] = useState('home');
  const [importKind, setImportKind] = useState('consignors');
  const [importBack, setImportBack] = useState('home');
  const [importConsignorId, setImportConsignorId] = useState(null);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState('');
  const [error, setError] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [payoutReceipt, setPayoutReceipt] = useState(null);
  const [payoutReceiptBackView, setPayoutReceiptBackView] = useState('payouts');
  function errorMessage(value, fallback) {
    return value instanceof Error ? value.message : fallback;
  }
  async function refreshData() {
    const data = await getConsignmentData();
    setShopCurrency(data.shop?.currencyCode || 'CAD');
    setConsignors(data.consignors);
    setItems(data.items);
    return data;
  }
  useEffect(() => {
    refreshData()
      .catch((e) => setError(errorMessage(e, 'Could not load Shopify data')))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document
      .querySelector('.consignment-body')
      ?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setShowBackToTop(false);
  }, [view]);
  useEffect(() => {
    if (!ready) return undefined;
    const body = document.querySelector('.consignment-body');
    const updateBackToTop = () =>
      setShowBackToTop(window.scrollY > 280 || (body?.scrollTop || 0) > 280);
    updateBackToTop();
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    body?.addEventListener('scroll', updateBackToTop, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateBackToTop);
      body?.removeEventListener('scroll', updateBackToTop);
    };
  }, [ready, view]);
  function scrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document
      .querySelector('.consignment-body')
      ?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }
  function flash(msg, tone = '') {
    setToast(msg);
    setToastTone(tone);
    setTimeout(() => {
      setToast('');
      setToastTone('');
    }, 2000);
  }
  async function handleNewConsignor(form) {
    try {
      setError('');
      const consignor = await createConsignor(form);
      await refreshData();
      flash(`Consignor #${consignor.number} added`);
      setActiveId(consignor.id);
      setView(newConsignorNext);
    } catch (e) {
      setError(errorMessage(e, 'Could not save consignor'));
    }
  }
  async function handleImport(kind, rows) {
    try {
      setError('');
      const result = await importConsignmentData(kind, rows);
      await refreshData();
      if (kind === 'consignors')
        flash(
          `${result.consignorsCreated || 0} created, ${result.consignorsUpdated || 0} matched/updated, ${result.itemsImported || 0} items imported, ${result.shopifyProductsCreated || 0} Shopify products created`,
        );
      else {
        const importedCount = result.itemsImported ?? result.imported;
        flash(
          `${importedCount} item${importedCount === 1 ? '' : 's'} imported, ${result.shopifyProductsCreated || 0} Shopify products created`,
        );
      }
      setView(importBack);
    } catch (e) {
      setError(errorMessage(e, 'Could not import this CSV'));
      throw e;
    }
  }
  function startImport(kind, backView, consignorId = null) {
    setImportKind(kind);
    setImportBack(backView);
    setImportConsignorId(consignorId);
    setView('import');
  }
  async function handleSaveBatch(batch) {
    try {
      setError('');
      const saved = await createConsignmentItems(activeId, batch);
      await refreshData();
      flash(`${saved.length} item${saved.length === 1 ? '' : 's'} saved`);
      setView('consignor');
    } catch (e) {
      setError(errorMessage(e, 'Could not save items'));
    }
  }
  async function handleSaveAndSync(currentEntry, queuedBatch, shopifyForm) {
    try {
      setError('');
      const saved = await createConsignmentItems(activeId, [
        ...queuedBatch,
        currentEntry,
      ]);
      const newItem = saved[saved.length - 1];
      await syncShopifyProduct(newItem.id, shopifyForm);
      await refreshData();
      flash(
        `${saved.length} item${saved.length === 1 ? '' : 's'} saved · Shopify product created`,
      );
      setActiveItemId(newItem.id);
      setView('editItem');
    } catch (e) {
      setError(
        errorMessage(
          e,
          'Could not save the item and create the Shopify product',
        ),
      );
      throw e;
    }
  }
  async function handleUpdateConsignor(consignorId, form) {
    try {
      setError('');
      await updateConsignor(consignorId, form);
      await refreshData();
      flash('Consignor updated');
      setView('consignor');
    } catch (e) {
      setError(errorMessage(e, 'Could not update consignor'));
    }
  }
  async function handleDeleteConsignor(consignorId) {
    try {
      setError('');
      await deleteConsignor(consignorId);
      await refreshData();
      setActiveId(null);
      setView('home');
      flash('Consignor deleted');
    } catch (e) {
      setError(errorMessage(e, 'Could not delete consignor'));
    }
  }
  async function handleDeleteItem(itemId) {
    try {
      setError('');
      await deleteConsignmentItem(itemId);
      await refreshData();
      flash('Item deleted');
    } catch (e) {
      setError(errorMessage(e, 'Could not delete item'));
    }
  }
  async function handleUpdateItem(itemId, form) {
    try {
      setError('');
      await updateConsignmentItem(itemId, form);
      await refreshData();
      flash('Item updated');
      setView('consignor');
    } catch (e) {
      setError(errorMessage(e, 'Could not update item'));
    }
  }
  async function handleUpdateItemStatus(itemId, status, details = {}) {
    try {
      setError('');
      await updateConsignmentItemStatus(itemId, status, details);
      await refreshData();
      flash(
        status === 'Paid'
          ? 'Item marked paid'
          : status === 'Sold'
            ? 'Item marked sold - unpaid'
            : 'Item returned to available',
      );
    } catch (e) {
      setError(errorMessage(e, 'Could not update item status'));
      throw e;
    }
  }
  async function handleSyncProduct(itemId, shopifyForm) {
    try {
      setError('');
      const wasAlreadyLinked = Boolean(
        items.find((entry) => entry.id === itemId)?.shopifyProductId,
      );
      await syncShopifyProduct(itemId, shopifyForm);
      await refreshData();
      flash(
        wasAlreadyLinked
          ? 'Your product has been updated'
          : 'Shopify product created',
        'success',
      );
    } catch (e) {
      setError(errorMessage(e, 'Could not sync the Shopify product'));
      throw e;
    }
  }
  async function handleRecordPayout(payout) {
    try {
      setError('');

      const result = await recordConsignorPayout(payout);
      const receiptConsignor = consignors.find(
        (entry) => entry.id === result.payout.consignorId,
      );

      setPayoutReceipt({
        payout: result.payout,
        items: result.items,
        consignor: receiptConsignor,
      });

      setPayoutReceiptBackView('payouts');

      await refreshData();
      flash(`Payout of ${money(result.payout.total)} recorded`);
      setView('payoutReceipt');
    } catch (e) {
      setError(errorMessage(e, 'Could not record payout'));
      throw e;
    }
  }
  function openPayoutReceipt(payoutId, backView = 'consignor') {
    const receiptItems = items.filter((item) => item.payoutId === payoutId);
    const firstItem = receiptItems[0];

    if (!firstItem) {
      setError('Could not find that payout receipt');
      return;
    }

    const receiptConsignor = consignors.find(
      (entry) => entry.id === firstItem.consignorId,
    );

    if (!receiptConsignor) {
      setError('Could not find the consignor for that receipt');
      return;
    }

    const itemTotal = receiptItems.reduce(
      (sum, item) => sum + Number(item.payoutAmount || 0),
      0,
    );

    setPayoutReceipt({
      consignor: receiptConsignor,
      items: receiptItems,
      payout: {
        id: payoutId,
        consignorId: firstItem.consignorId,
        date: firstItem.payoutDate,
        method: firstItem.payoutMethod || '—',
        reference: firstItem.payoutReference || '',
        note: firstItem.payoutNote || '',
        adjustment: Number(firstItem.payoutAdjustment || 0),
        total: Number(firstItem.payoutTotal ?? itemTotal),
        itemIds: receiptItems.map((item) => item.id),
      },
    });
    setActiveId(receiptConsignor.id);
    setPayoutReceiptBackView(backView);
    setView('payoutReceipt');
  }
  async function handleDeleteItemFromEdit(itemId) {
    await handleDeleteItem(itemId);
    setView('consignor');
  }
  const activeConsignor = consignors.find((c) => c.id === activeId);
  const activeItem = items.find((i) => i.id === activeItemId);
  const nextConsignorNumber =
    Math.max(
      0,
      ...consignors.map((consignor) => Number(consignor.number) || 0),
    ) + 1;
  const navigationView = [
    'newConsignor',
    'chooseConsignor',
    'consignor',
    'intake',
    'editConsignor',
  ].includes(view)
    ? 'home'
    : view === 'editItem'
      ? 'items'
      : ['createPayout', 'payoutReceipt'].includes(view)
        ? 'payouts'
        : view;
  function navigate(viewName) {
    setError('');
    setView(viewName);
  }
  function openConsignor(id) {
    setActiveId(id);
    setView('consignor');
  }
  function openItem(id) {
    const item = items.find((entry) => entry.id === id);
    setActiveItemId(id);
    if (item?.consignorId) setActiveId(item.consignorId);
    setView('editItem');
  }
  function startNewConsignor(nextView = 'consignor', backView = 'home') {
    setNewConsignorNext(nextView);
    setNewConsignorBack(backView);
    setView('newConsignor');
  }
  function startNewItem() {
    setView('chooseItemType');
  }
  return (
    <div className="consignment">
      {ready && <AppNavigation view={navigationView} onNavigate={navigate} />}
      {toast && (
        <div
          className="consignment-toast"
          style={
            toastTone === 'success' ? { background: '#1C7A3E' } : undefined
          }
        >
          <Check size={14} /> {toast}
        </div>
      )}
      {error && (
        <div
          className="consignment-toast"
          style={{ background: 'var(--danger)', top: 12 }}
        >
          <X size={14} /> {error}
        </div>
      )}
      {!ready && (
        <div className="consignment-loading">
          <Loader2 className="consignment-spin" size={22} />
        </div>
      )}
      {ready && view === 'dashboard' && (
        <DashboardScreen
          consignors={consignors}
          items={items}
          onOpenConsignor={openConsignor}
          onNavigate={navigate}
          onNewConsignor={() => startNewConsignor('consignor', 'dashboard')}
          onNewItem={startNewItem}
          onImport={() => startImport('consignors', 'dashboard')}
          onExport={() => exportConsignors(consignors)}
        />
      )}
      {ready && view === 'home' && (
        <ConsignorsScreen
          consignors={consignors}
          items={items}
          query={query}
          setQuery={setQuery}
          tier2Enabled={tier2Enabled}
          onOpenConsignor={openConsignor}
          onOpenItem={openItem}
          onMarkSold={(itemId, details) =>
            handleUpdateItemStatus(itemId, 'Sold', details)
          }
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
          onNewConsignor={() => startNewConsignor('consignor', 'home')}
          onNewItem={startNewItem}
          onImport={() => startImport('consignors', 'home')}
          onExport={() => exportConsignors(consignors)}
        />
      )}
      {ready && view === 'items' && (
        <ItemsScreen
          items={items}
          consignors={consignors}
          tier2Enabled={tier2Enabled}
          onOpenItem={openItem}
          onOpenConsignor={openConsignor}
          onMarkSold={(itemId, details) =>
            handleUpdateItemStatus(itemId, 'Sold', details)
          }
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
          onNewItem={startNewItem}
        />
      )}
      {ready && view === 'sales' && (
        <SalesScreen
          items={items}
          consignors={consignors}
          tier2Enabled={tier2Enabled}
          onOpenItem={openItem}
          onOpenConsignor={openConsignor}
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
        />
      )}
      {ready && view === 'payouts' && (
        <PayoutsScreen
          items={items}
          consignors={consignors}
          tier2Enabled={tier2Enabled}
          onOpenItem={openItem}
          onOpenConsignor={openConsignor}
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
        />
      )}
      {ready && view === 'reports' && (
        <ReportsScreen
          items={items}
          consignors={consignors}
          onOpenConsignor={openConsignor}
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
        />
      )}
      {ready && view === 'chooseItemType' && (
        <>
          <Header
            eyebrow="Add item"
            title="Choose item type"
            onBack={() => setView('dashboard')}
          />
          <div className="consignment-body">
            <div className="consignment-form-shell">
              <section className="consignment-form-section">
                <div
                  className="consignment-form-section-body"
                  style={{ display: 'grid', gap: 12 }}
                >
                  <button
                    className="consignment-btn"
                    type="button"
                    onClick={() => {
                      if (!consignors.length) {
                        startNewConsignor('intake', 'chooseItemType');
                        return;
                      }
                      setView('chooseConsignor');
                    }}
                  >
                    <Users size={16} /> Consignment Item
                  </button>
                  <button
                    className="consignment-btn"
                    type="button"
                    onClick={() => setView('shopifyProduct')}
                  >
                    <ShoppingBag size={16} /> Shopify Product
                  </button>
                  <button
                    className="consignment-btn secondary"
                    type="button"
                    onClick={() => setView('existingProductMetaPost')}
                  >
                    <PackageSearch size={16} /> Post Existing Shopify Product
                  </button>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
      {ready && view === 'shopifyProduct' && (
        <ShopifyProductScreen
          onBack={() => setView('chooseItemType')}
          tier2Enabled={tier2Enabled}
          onCreated={() => flash('Shopify product created', 'success')}
        />
      )}
      {ready && view === 'existingProductMetaPost' && (
        <ExistingProductMetaPostScreen
          onBack={() => setView('chooseItemType')}
        />
      )}
      {ready && view === 'createPayout' && activeConsignor && (
        <CreatePayoutScreen
          consignor={activeConsignor}
          items={items}
          onBack={() => setView('payouts')}
          onRecordPayout={handleRecordPayout}
        />
      )}
      {ready && view === 'payoutReceipt' && payoutReceipt && (
        <PayoutReceiptScreen
          receipt={payoutReceipt}
          onBack={() => setView(payoutReceiptBackView)}
          onOpenConsignor={() => {
            setActiveId(payoutReceipt.consignor.id);
            setView('consignor');
          }}
        />
      )}
      {ready && view === 'import' && (
        <ImportScreen
          kind={importKind}
          fixedConsignor={
            consignors.find((entry) => entry.id === importConsignorId) || null
          }
          onBack={() => setView(importBack)}
          onImport={handleImport}
        />
      )}
      {ready && view === 'newConsignor' && (
        <ConsignorFormScreen
          onBack={() => setView(newConsignorBack)}
          onSave={handleNewConsignor}
          nextNumber={nextConsignorNumber}
        />
      )}
      {ready && view === 'chooseConsignor' && (
        <ChooseConsignorScreen
          consignors={consignors}
          onBack={() => setView('dashboard')}
          onChoose={(consignorId) => {
            setActiveId(consignorId);
            setView('intake');
          }}
          onCreate={() => startNewConsignor('intake', 'chooseConsignor')}
        />
      )}
      {ready && view === 'consignor' && activeConsignor && (
        <ConsignorDashboard
          consignor={activeConsignor}
          items={items}
          onOpenPayoutReceipt={(payoutId) => openPayoutReceipt(payoutId, 'consignor')}
          onBack={() => setView('home')}
          onStartIntake={() => setView('intake')}
          onOpenItem={openItem}
          onDeleteConsignor={handleDeleteConsignor}
          onEditConsignor={() => setView('editConsignor')}
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
        />
      )}
      {ready && view === 'editConsignor' && activeConsignor && (
        <ConsignorFormScreen
          consignor={activeConsignor}
          onBack={() => setView('consignor')}
          onSave={handleUpdateConsignor}
        />
      )}
      {ready && view === 'intake' && activeConsignor && (
        <IntakeScreen
          consignor={activeConsignor}
          items={items}
          onBack={() => setView('consignor')}
          onSaveBatch={handleSaveBatch}
          onSaveAndSync={handleSaveAndSync}
          tier2Enabled={tier2Enabled}
        />
      )}
      {ready && view === 'editItem' && activeItem && (
        <EditItemScreen
          item={activeItem}
          consignor={
            consignors.find((entry) => entry.id === activeItem.consignorId) ||
            null
          }
          currency={shopCurrency}
          onBack={() => setView('consignor')}
          onSave={handleUpdateItem}
          onDelete={handleDeleteItemFromEdit}
          onSyncProduct={handleSyncProduct}
          onUpdateStatus={handleUpdateItemStatus}
          onOpenPayoutReceipt={(payoutId) =>
            openPayoutReceipt(payoutId, 'editItem')
          }
          onStartPayout={(consignorId) => {
            setActiveId(consignorId);
            setView('createPayout');
          }}
          tier2Enabled={tier2Enabled}
        />
      )}
      {ready && showBackToTop && (
        <button
          className="consignment-back-to-top"
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
