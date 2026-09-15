/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState, useEffect } from 'react';
import {
  Plus, Camera, Image, X, ChevronRight, Phone, Mail,
  Loader2, Tag, Check, Trash2, ShoppingBag, LayoutDashboard,
  Users, ReceiptText, WalletCards, PackageSearch, TrendingUp, CircleDollarSign,
  CalendarDays, FileUp, Download, MapPin, Pencil, List, Grid3X3, ArrowUp,
} from 'lucide-react';
import {
  createConsignor,
  createConsignmentItems,
  deleteConsignor,
  syncShopifyProduct,
  deleteConsignmentItem,
  getConsignmentData,
  recordConsignorPayout,
  searchShopifyCategories,
  searchShopifyFiles,
  updateConsignmentItem,
  updateConsignmentItemStatus,
  updateConsignor,
  importConsignmentData,
} from './consignmentApi';
import ReportsScreen from './pages/consignment/ReportsScreen';
import DashboardScreen from './pages/consignment/DashboardScreen';
import ItemsScreen from './pages/consignment/ItemsScreen';
import Header from './components/consignment/Header';
import ManualSaleStatus from './components/consignment/ManualSaleStatus';
import ItemBarcode from './components/consignment/ItemBarcode';
import ConsignorsScreen from './pages/consignment/ConsignorsScreen';
import SalesScreen from './pages/consignment/SalesScreen';
import PayoutsScreen from './pages/consignment/PayoutsScreen';
import PayoutReceiptScreen from './pages/consignment/PayoutReceiptScreen';
import ConsignorDashboard from './pages/consignment/ConsignorDashboard';
import CreateConsignorScreen from './pages/consignment/CreateConsignorScreen';
import ConsignmentFilterBar from './components/consignment/ConsignmentFilterBar';
import './styles/consignment-global.css';
import './styles/consignment-forms.css';
import './styles/shopify-file-picker.css';
/* ============================================================================
   STYLING
   All app CSS is external. This intake file contains no embedded GlobalStyle().
   Shared app styles: ./styles/consignment-global.css
   Shared filter/search/view styles: ./styles/consignment-filter-bar.css
   ============================================================================ */
import { csvValue, downloadCsv, money } from './lib/consignmentHelpers';

/* ---------- image helper ---------- */

function resizeImage(file, maxWidth = 320, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result !== 'string') {
        reject(new Error('Could not read this image'));
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CATEGORIES = [
  'Clothing',
  'Shoes',
  'Jewellery',
  'Handbags & Accessories',
  'Baby & Kids',
  'Toys & Games',
  'Bicycles & Cycling',
  'Sporting Goods',
  'Outdoor & Camping',
  'Home Decor',
  'Furniture',
  'Kitchen & Housewares',
  'Electronics',
  'Appliances',
  'Books & Media',
  'Video Games',
  'Collectibles',
  'Tools',
  'Automotive',
  'Pet Supplies',
  'Art',
  'Other',
];
const CONDITIONS = ['New with tags', 'Like new', 'Good', 'Fair'];

function buildShopifyAutoFill(item = {}, consignor = null) {
  const description = String(item.description || '').trim();
  const brand = String(item.brand || '').trim();
  const size = String(item.size || '').trim();
  const condition = String(item.condition || '').trim();
  const category = String(item.category || '').trim();
  const type = String(item.type || '').trim();

  return {
    shopifyTitle: description,
    shopifyPrice: item.price ?? '',
    vendor: brand,
    tags: [...new Set([
      'Consignment',
      consignor?.number ? `Consignor ${consignor.number}` : '',
      category,
      type,
      brand,
      condition,
    ].filter(Boolean))].join(', '),
    productDescription: [
      description,
      brand ? `Brand: ${brand}` : '',
      size ? `Size: ${size}` : '',
      condition ? `Condition: ${condition}` : '',
      category ? `Category: ${category}` : '',
    ].filter(Boolean).join('\n'),
    seoTitle: '',
    seoDescription: '',
  };
}

function productLabel(item) {
  if (!item?.shopifyProductId) return { text: 'Manual', className: 'manual' };

  const productStatus = String(item.shopifyProductStatus || '').toUpperCase();
  if (productStatus && productStatus !== 'ACTIVE') {
    return { text: 'Shopify Draft', className: 'draft' };
  }

  return item.publishOnline
    ? { text: 'POS + Online', className: 'online' }
    : { text: 'POS', className: 'pos' };
}

/* ---------- small components ---------- */

function useIsDesktopAdmin() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function check() {
      if (cancelled) return;
      const environment = window.shopify?.environment;
      if (environment) {
        setIsDesktop(!environment.mobile);
        return;
      }
      attempts += 1;
      if (attempts < 20) setTimeout(check, 100);
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return isDesktop;
}

async function handlePhotoFile(e, onChange) {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await resizeImage(file);
  onChange(dataUrl);
}

function ShopifyFilePicker({ onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerError, setPickerError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setPickerError('');
      try {
        const results = await searchShopifyFiles(search);
        if (!cancelled) setFiles(results);
      } catch (error) {
        if (!cancelled) {
          setFiles([]);
          setPickerError(error instanceof Error ? error.message : 'Could not load Shopify Files.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, search.trim() ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="shopify-file-picker-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="shopify-file-picker-modal" role="dialog" aria-modal="true" aria-labelledby="shopify-file-picker-title">
        <header className="shopify-file-picker-header">
          <div className="shopify-file-picker-heading">
            <strong id="shopify-file-picker-title">Choose from Shopify Files</strong>
            <span>Select an image already stored in Shopify Content Ã¢â€ â€™ Files.</span>
          </div>
          <button type="button" className="shopify-file-picker-close" onClick={onClose} aria-label="Close Shopify Files"><X size={18} /></button>
        </header>
        <div className="shopify-file-picker-search">
          <input className="consignment-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Shopify Files" autoFocus />
        </div>
        <div className="shopify-file-picker-content">
          {loading && <div className="shopify-file-picker-state"><Loader2 className="consignment-spin" size={18} /><span>Loading Shopify FilesÃ¢â‚¬Â¦</span></div>}
          {!loading && pickerError && <div className="shopify-file-picker-state error">{pickerError}</div>}
          {!loading && !pickerError && files.length === 0 && <div className="shopify-file-picker-state">No Shopify images found.</div>}
          {!loading && !pickerError && files.length > 0 && (
            <div className="shopify-file-picker-grid">
              {files.map((file) => (
                <button key={file.id} type="button" className="shopify-file-picker-card" onClick={() => onSelect(file)}>
                  <span className="shopify-file-picker-image"><img src={file.url} alt={file.alt || 'Shopify file'} /></span>
                  <span className="shopify-file-picker-name">{file.alt || 'Shopify image'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PhotoPicker({ value, onChange, onChooseShopify }) {
  const [showShopifyFiles, setShowShopifyFiles] = useState(false);
  return (
    <>
      <div className="consignment-photo-wrap">
        <label className="consignment-photo-btn">
          {value ? <img src={value} alt="Item" /> : <><Camera size={20} /><span>Take Photo</span></>}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handlePhotoFile(e, onChange)} />
        </label>
        <label className="consignment-photo-alt">
          {value ? 'Retake or choose' : 'Choose from library'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoFile(e, onChange)} />
        </label>
        <button type="button" className="shopify-file-picker-trigger" onClick={() => setShowShopifyFiles(true)}><Image size={15} /><span>Choose from Shopify Files</span></button>
      </div>
      {showShopifyFiles && <ShopifyFilePicker onClose={() => setShowShopifyFiles(false)} onSelect={(file) => { onChooseShopify(file); setShowShopifyFiles(false); }} />}
    </>
  );
}

function statusClass(status) { return String(status || 'Draft').toLowerCase(); }
function statusLabel(status) { const value = status || 'Draft'; return value === 'Draft' ? 'Available' : value; }

function AppNavigation({ view, onNavigate }) {
  const entries = [['dashboard','Dashboard',LayoutDashboard],['home','Consignors',Users],['items','Items',PackageSearch],['sales','Sales',ReceiptText],['payouts','Payouts',WalletCards],['reports','Reports',TrendingUp]];
  return (
    <nav className="consignment-main-nav" aria-label="Consignment manager">
      <div className="consignment-brand"><span className="consignment-brand-mark"><Tag size={18} /></span>JustConsignIn</div>
      {entries.map(([key,label,Icon]) => <button key={key} type="button" className={`consignment-nav-button ${view === key ? 'active' : ''}`} onClick={() => onNavigate(key)}><Icon size={17} />{label}</button>)}
    </nav>
  );
}

function formatPayoutSoldDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function CreatePayoutScreen({ consignor, items, onBack, onRecordPayout }) {
  const eligible = items.filter(
    (item) =>
      item.consignorId === consignor.id &&
      (item.status === 'Sold' || item.dateSold) &&
      !item.paidOut,
  );

  const [selectedIds, setSelectedIds] = useState(() =>
    eligible.map((item) => item.id),
  );
  const [adjustment, setAdjustment] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('E-transfer');
  const [reference, setReference] = useState('');
  const [payoutDate, setPayoutDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  const selected = eligible.filter((item) =>
    selectedIds.includes(item.id),
  );

  const itemTotal = selected.reduce((sum, item) => {
    const salePrice = Number(item.salePrice ?? item.price ?? 0);
    const commissionRate = Number(
      item.commissionPct ?? consignor.commissionPct ?? 0,
    );

    return sum + (salePrice * commissionRate) / 100;
  }, 0);

  const payoutTotal = itemTotal + Number(adjustment || 0);

  function toggleItem(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  async function recordPayout() {
    setSaving(true);

    try {
      await onRecordPayout({
        consignorId: consignor.id,
        itemIds: selectedIds,
        adjustment: Number(adjustment || 0),
        payoutDate,
        method,
        reference,
        note,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header
        eyebrow={`Consignor #${consignor.number}`}
        title="Create payout"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-form-shell consignment-payout-shell">
          <section className="consignment-form-section consignment-payout-card">
            <div className="consignment-payout-summary-grid">
              <div className="consignment-payout-summary-cell">
                <span className="consignment-label">Consignor</span>
                <strong>
                  {consignor.firstName} {consignor.lastName}
                </strong>
                <small>Default commission: {consignor.commissionPct}%</small>
              </div>

              <div className="consignment-payout-summary-cell">
                <span className="consignment-label">Selected sales</span>
                <strong>{selected.length}</strong>
                <small>Consignor earnings: {money(itemTotal)}</small>
              </div>

              <div className="consignment-payout-summary-cell">
                <span className="consignment-label">Amount due</span>
                <strong className="consignment-payout-total-value">
                  {money(payoutTotal)}
                </strong>
                <small>Includes manual adjustment</small>
              </div>
            </div>

            <div className="consignment-payout-section">
              <div className="consignment-payout-section-head">
                <div>
                  <h2>Items in this payout</h2>
                  <p>Select the eligible sold items to include.</p>
                </div>

                <button
                  type="button"
                  className="consignment-link-button"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === eligible.length
                        ? []
                        : eligible.map((item) => item.id),
                    )
                  }
                >
                  {selectedIds.length === eligible.length
                    ? 'Exclude all'
                    : 'Select all'}
                </button>
              </div>

              <div className="consignment-payout-items">
                {eligible.length === 0 && (
                  <div className="consignment-empty-small">
                    This consignor has no eligible unpaid sales.
                  </div>
                )}

                {eligible.map((item) => {
                  const salePrice = Number(item.salePrice ?? item.price ?? 0);
                  const rate = Number(
                    item.commissionPct ?? consignor.commissionPct ?? 0,
                  );
                  const due = (salePrice * rate) / 100;

                  return (
                    <label key={item.id} className="consignment-payout-item-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />

                      <span className="consignment-payout-item-main">
                        <strong>{item.description || item.itemNumber}</strong>
                        <span>
                          {item.orderName || item.itemNumber} · Sale {money(salePrice)} · Sold {formatPayoutSoldDate(item.dateSold)}
                        </span>
                      </span>

                      <span className="consignment-payout-item-rate">
                        <span className="consignment-label">Rate</span>
                        <strong>{rate}%</strong>
                      </span>

                      <strong className="consignment-payout-item-due">
                        {money(due)}
                      </strong>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="consignment-payout-section">
              <div className="consignment-payout-section-head">
                <div>
                  <h2>Payment details</h2>
                  <p>Record how and when the consignor is being paid.</p>
                </div>
              </div>

              <div className="consignment-form-grid consignment-form-grid-3 consignment-payout-payment-grid">
                <div className="consignment-form-field">
                  <label className="consignment-label">Payment method</label>
                  <select
                    className="consignment-select"
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                  >
                    <option>E-transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Store credit</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Payout date</label>
                  <input
                    className="consignment-input"
                    type="date"
                    value={payoutDate}
                    onChange={(event) => setPayoutDate(event.target.value)}
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Reference</label>
                  <input
                    className="consignment-input"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder={
                      method === 'Store credit'
                        ? 'Credit memo or note'
                        : 'Optional confirmation #'
                    }
                  />
                </div>

                <div className="consignment-form-field">
                  <label className="consignment-label">Manual adjustment</label>
                  <input
                    className="consignment-input"
                    type="number"
                    inputMode="decimal"
                    value={adjustment}
                    onChange={(event) => setAdjustment(event.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="consignment-form-field consignment-payout-note-field">
                  <label className="consignment-label">Payout note</label>
                  <input
                    className="consignment-input"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional payment reference or note"
                  />
                </div>
              </div>

              {method === 'Store credit' && (
                <div className="consignment-form-help consignment-payout-store-credit-help">
                  <CircleDollarSign size={17} />
                  This records the amount as store credit in the payout ledger
                  and on each linked Shopify product.
                </div>
              )}
            </div>

            <div className="consignment-payout-footer">
              <div>
                <span className="consignment-label">Total payout</span>
                <strong>{money(payoutTotal)}</strong>
              </div>

              <button
                type="button"
                className="consignment-btn"
                disabled={!selected.length || saving}
                onClick={recordPayout}
              >
                <WalletCards size={17} />
                {saving ? 'Recording payout…' : 'Record payout'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/* ---------- screens ---------- */

function ChooseConsignorScreen({ consignors, onBack, onChoose, onCreate }) {
  const [search, setSearch] = useState('');
  const filtered = consignors.filter((consignor) => { const query=search.trim().toLowerCase(); return !query || `${consignor.firstName} ${consignor.lastName} ${consignor.number}`.toLowerCase().includes(query); });
  return (<><Header eyebrow="New item" title="Choose consignor" onBack={onBack} /><div className="consignment-body"><button type="button" className="consignment-quick-action primary" onClick={onCreate} style={{ width:'100%',marginBottom:14 }}><span className="consignment-quick-action-icon"><Plus size={19} /></span><span className="consignment-quick-action-copy"><strong>Create new consignor</strong><span>Add their details, then continue directly to the item</span></span></button><ConsignmentFilterBar search={{ value:search,onChange:setSearch,placeholder:'Search name or consignor number' }} />{filtered.map((consignor) => <button key={consignor.id} type="button" className="consignment-row-btn" onClick={() => onChoose(consignor.id)}><div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div><div className="consignment-row-main"><div className="consignment-row-name">{consignor.firstName} {consignor.lastName}</div><div className="consignment-row-sub">Consignor #{consignor.number}</div></div><ChevronRight size={18} className="consignment-chev" /></button>)}{filtered.length === 0 && <div className="consignment-empty"><h3>No matching consignor</h3><p>Create a new consignor to continue.</p></div>}</div></>);
}

function parseCsv(text) { const rows=[]; let row=[],field='',quoted=false; for(let index=0;index<text.length;index+=1){const char=text[index];if(char==='"'&&quoted&&text[index+1]==='"'){field+='"';index+=1;}else if(char==='"')quoted=!quoted;else if(char===','&&!quoted){row.push(field.trim());field='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[index+1]==='\n')index+=1;row.push(field.trim());field='';if(row.some(Boolean))rows.push(row);row=[];}else field+=char;}row.push(field.trim());if(row.some(Boolean))rows.push(row);if(rows.length<2)throw new Error('The CSV needs a header row and at least one data row.');const headers=rows[0].map((value)=>value.toLowerCase().replace(/\s+/g,'_'));return rows.slice(1).map((values)=>Object.fromEntries(headers.map((header,index)=>[header,values[index]||'']))); }

function exportConsignors(consignors) { const headers=['number','first_name','last_name','phone','email','address','city','province','postal_code','date_joined','commission_pct','unsold_preference','notes']; const rows=consignors.map((c)=>[c.number,c.firstName,c.lastName,c.phone,c.email,c.address,c.city,c.province,c.postalCode,c.dateJoined,c.commissionPct,c.unsoldPreference,c.notes]); downloadCsv(`consignors-${new Date().toISOString().slice(0,10)}.csv`,headers,rows); }
function exportItems(items, consignors) { const consignorById=Object.fromEntries(consignors.map((c)=>[c.id,c])); const headers=['item_number','consignor_number','description','price','category','type','size','condition','status','date_received','commission_pct','notes','tags','brand','vendor','product_description','sale_price','date_sold','order_name','order_id','paid_out','payout_id','payout_date','payout_method','payout_reference','payout_note','payout_amount','payout_total','payout_adjustment','shopify_product_id']; const rows=items.map((item)=>[item.itemNumber,consignorById[item.consignorId]?.number||'',item.description,item.price,item.category,item.type,item.size,item.condition,item.status,item.dateReceived,item.commissionPct,item.notes,Array.isArray(item.tags)?item.tags.join('|'):item.tags||'',item.brand,item.vendor,item.productDescription,item.salePrice,item.dateSold,item.orderName,item.orderId,item.paidOut?'true':'false',item.payoutId,item.payoutDate,item.payoutMethod,item.payoutReference,item.payoutNote,item.payoutAmount,item.payoutTotal,item.payoutAdjustment,item.shopifyProductId]); downloadCsv(`items-${new Date().toISOString().slice(0,10)}.csv`,headers,rows); }

function ImportScreen({ kind, onBack, onImport, fixedConsignor = null }) {
  const [fileName,setFileName]=useState(''); const [rows,setRows]=useState([]); const [localError,setLocalError]=useState(''); const [saving,setSaving]=useState(false); const isConsignors=kind==='consignors';
  const required=isConsignors?'consignor_import_key, first_name, last_name; item_description and price when the row contains an item':fixedConsignor?'item_description, price':'consignor_import_key (or email/phone), item_description, price';
  const templateConsignorNumber=fixedConsignor?.number||1; const itemColumns='item_import_key,item_description,price,category,item_type,brand,size,condition,item_notes,status,date_received,consignment_term,expiry_action,create_shopify_product,shopify_title,shopify_price,shopify_description,shopify_vendor,shopify_tags,publish_to_pos,publish_online,seo_title,seo_description,sale_price,sale_date,payout_status';
  const template=isConsignors?`consignor_import_key,first_name,last_name,phone,email,address,city,province,postal_code,date_joined,commission_pct,unsold_preference,consignor_notes,${itemColumns}\njane-smith-9055550100,Jane,Smith,905-555-0100,jane@example.com,123 Main Street,Hamilton,Ontario,L8E 1A1,2026-07-30,50,Please return,,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`:fixedConsignor?`${itemColumns},consignor_number\nitem-001,Blue baby sweater,18.00,Clothing,Sweater,Gap,12M,Good,,Available,2026-07-30,60,Please return,true,Blue baby sweater,18.00,Soft blue baby sweater,Gap,baby|sweater,true,false,Blue baby sweater,Soft blue baby sweater,,,${templateConsignorNumber}`:`consignor_import_key,email,phone,${itemColumns}\njane-smith-9055550100,jane@example.com,905-555-0100,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`;
  function downloadTemplate(){const blob=new Blob([template],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${kind}-import-template.csv`;link.click();URL.revokeObjectURL(url);}
  async function chooseFile(event){const file=event.target.files?.[0];if(!file)return;try{let parsed=parseCsv(await file.text());if(!isConsignors&&fixedConsignor){parsed=parsed.map((row)=>({...row,consignor_number:fixedConsignor.number}));}setRows(parsed);setFileName(file.name);setLocalError('');}catch(error){setRows([]);setFileName(file.name);setLocalError(error.message);}}
  return (<><Header eyebrow="Data import" title={isConsignors?'Import consignors and items':fixedConsignor?`Import items for ${fixedConsignor.firstName} ${fixedConsignor.lastName}`:'Import items'} onBack={onBack} /><div className="consignment-body"><div className="consignment-card"><strong style={{ fontSize:14 }}>Start with the template</strong><p className="consignment-import-help">Required columns: {required}. The app assigns consignor and item numbers automatically. Keep the headings unchanged, fill in your rows, then save as CSV.{fixedConsignor&&!isConsignors?` Every row will be assigned to consignor #${fixedConsignor.number}.`:''}</p><button className="consignment-btn secondary" onClick={downloadTemplate}><Download size={16} /> Download template</button></div><div className="consignment-import-drop"><label><FileUp size={24} /><span>{fileName||'Choose CSV file'}</span><input type="file" accept=".csv,text/csv" onChange={chooseFile} /></label><div className="consignment-import-help">Nothing is imported until you review the count and press Import.</div></div>{localError&&<div className="consignment-card" style={{ color:'var(--danger)' }}>{localError}</div>}{rows.length>0&&<><div className="consignment-import-preview"><div><span>File</span><strong style={{ fontSize:12 }}>{fileName}</strong></div><div><span>Rows ready</span><strong>{rows.length}</strong></div><div><span>Importing</span><strong style={{ fontSize:13 }}>{isConsignors?'Consignors + items Ã‚Â· Shopify supported':'Items Ã‚Â· Shopify supported'}</strong></div></div><div className="consignment-import-actions"><button className="consignment-btn" disabled={saving} onClick={async()=>{setSaving(true);try{await onImport(kind,rows);}finally{setSaving(false);}}}>{saving?<Loader2 className="consignment-spin" size={16}/>:<FileUp size={16}/>} Import {rows.length} row{rows.length===1?'':'s'}</button></div></>}</div></>);
}

function EditConsignorScreen({ consignor, onBack, onSave }) {
  const [form,setForm]=useState({number:consignor.number,firstName:consignor.firstName||'',lastName:consignor.lastName||'',phone:consignor.phone||'',email:consignor.email||'',address:consignor.address||'',city:consignor.city||'',province:consignor.province||'Ontario',postalCode:consignor.postalCode||'',commissionPct:consignor.commissionPct??50,unsoldPreference:consignor.unsoldPreference||'Please return',notes:consignor.notes||''}); const set=(k)=>(e)=>setForm((f)=>({...f,[k]:e.target.value})); const valid=form.firstName.trim()&&form.lastName.trim();
  return (<><Header eyebrow={`Consignor #${consignor.number}`} title="Edit consignor" onBack={onBack}/><div className="consignment-body"><div className="consignment-field"><label className="consignment-label">Consignor number</label><input className="consignment-input" type="number" inputMode="numeric" min="1" step="1" value={form.number} onChange={set('number')}/></div><div className="consignment-row2"><div className="consignment-field"><label className="consignment-label">First name</label><input className="consignment-input" value={form.firstName} onChange={set('firstName')} placeholder="Sarah"/></div><div className="consignment-field"><label className="consignment-label">Last name</label><input className="consignment-input" value={form.lastName} onChange={set('lastName')} placeholder="Lee"/></div></div><div className="consignment-row2"><div className="consignment-field"><label className="consignment-label">Phone</label><input className="consignment-input" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(416) 555-0134"/></div><div className="consignment-field"><label className="consignment-label">Email</label><input className="consignment-input" type="email" value={form.email} onChange={set('email')} placeholder="sarah@email.com"/></div></div><div className="consignment-field"><label className="consignment-label">Street address</label><input className="consignment-input" value={form.address} onChange={set('address')} placeholder="123 Main Street" autoComplete="street-address"/></div><div className="consignment-row2"><div className="consignment-field"><label className="consignment-label">City</label><input className="consignment-input" value={form.city} onChange={set('city')} placeholder="Hamilton" autoComplete="address-level2"/></div><div className="consignment-field"><label className="consignment-label">Province</label><input className="consignment-input" value={form.province} onChange={set('province')} placeholder="Ontario" autoComplete="address-level1"/></div></div><div className="consignment-field"><label className="consignment-label">Postal code</label><input className="consignment-input" value={form.postalCode} onChange={set('postalCode')} placeholder="L8E 1A1" autoCapitalize="characters" autoComplete="postal-code"/></div><div className="consignment-field"><label className="consignment-label">Commission split &mdash; consignor gets</label><input className="consignment-input" type="number" inputMode="decimal" value={form.commissionPct} onChange={set('commissionPct')} placeholder="50"/></div><div className="consignment-field"><label className="consignment-label">Unsold items</label><select className="consignment-select" value={form.unsoldPreference} onChange={set('unsoldPreference')}><option value="Please return">Please return</option><option value="Donation okay">Donation okay</option><option value="Ask me first">Ask me first</option></select></div><div className="consignment-field"><label className="consignment-label">Notes (optional)</label><textarea className="consignment-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering"/></div></div><div className="consignment-fab-wrap"><button className="consignment-btn" disabled={!valid} onClick={()=>onSave(consignor.id,form)}><Check size={18}/> Save changes</button></div></>);
}

function ConsignmentItemFields({ form, setForm }) { const set=(key)=>(event)=>setForm((current)=>({...current,[key]:event.target.value})); function setCategory(category){setForm((current)=>({...current,category,type:''}));} return <div className="consignment-card consignment-detail-card"><div className="consignment-section-heading"><label className="consignment-label">Consignment item information</label><span className="consignment-row-sub">Manual metaobject record</span></div><div className="consignment-detail-grid"><div className="consignment-field"><label className="consignment-label">Category</label><select className="consignment-select" value={form.category} onChange={(event)=>setCategory(event.target.value)}>{CATEGORIES.map((category)=><option key={category} value={category}>{category}</option>)}</select></div><div className="consignment-field"><label className="consignment-label">Brand</label><input className="consignment-input" value={form.brand} onChange={set('brand')} placeholder="e.g. Gap"/></div><div className="consignment-field"><label className="consignment-label">Size</label><input className="consignment-input" value={form.size} onChange={set('size')} placeholder="Optional"/></div><div className="consignment-field"><label className="consignment-label">Condition</label><select className="consignment-select" value={form.condition} onChange={set('condition')}>{CONDITIONS.map((condition)=><option key={condition} value={condition}>{condition}</option>)}</select></div><div className="consignment-field wide"><label className="consignment-label">Internal notes</label><textarea className="consignment-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Notes about this consigned item"/></div></div></div>; }

function ShopifyProductFields({ form, setForm }) {
  const [categorySearch,setCategorySearch]=useState(form.shopifyCategoryName||''); const [categoryResults,setCategoryResults]=useState([]); const [searchingCategories,setSearchingCategories]=useState(false);
  useEffect(()=>{const query=categorySearch.trim();if(query.length<2||query===form.shopifyCategoryName){setCategoryResults([]);return undefined;}const timer=setTimeout(()=>{setSearchingCategories(true);searchShopifyCategories(query).then(setCategoryResults).catch(()=>setCategoryResults([])).finally(()=>setSearchingCategories(false));},350);return()=>clearTimeout(timer);},[categorySearch,form.shopifyCategoryName]);
  const set=(key)=>(event)=>setForm((current)=>({...current,[key]:event.target.value}));
  return <div className="consignment-shopify-fields"><div className="consignment-detail-grid"><div className="consignment-field wide"><label className="consignment-label">Shopify title</label><input className="consignment-input" value={form.shopifyTitle||''} onChange={set('shopifyTitle')} placeholder="Auto-filled from item description"/></div><div className="consignment-field"><label className="consignment-label">Shopify price</label><input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.shopifyPrice??''} onChange={set('shopifyPrice')} placeholder="Defaults to the manual item price"/></div><div className="consignment-field"><label className="consignment-label">Vendor</label><input className="consignment-input" value={form.vendor} onChange={set('vendor')} placeholder="Defaults to store name"/></div><div className="consignment-field"><label className="consignment-label">Tags</label><input className="consignment-input" value={form.tags} onChange={set('tags')} placeholder="summer, baby"/></div><div className="consignment-field wide"><label className="consignment-label">Shopify product category</label><input className="consignment-input" value={categorySearch} onChange={(event)=>{setCategorySearch(event.target.value);if(event.target.value!==form.shopifyCategoryName){setForm((current)=>({...current,shopifyCategoryId:'',shopifyCategoryName:''}));}}} placeholder="Search Shopify categories"/>{searchingCategories&&<div className="consignment-row-sub" style={{ marginTop:6 }}>Searching ShopifyÃ¢â‚¬Â¦</div>}{categoryResults.length>0&&<div className="consignment-category-results">{categoryResults.map((category)=><button key={category.id} type="button" className="consignment-category-result" onClick={()=>{setForm((current)=>({...current,shopifyCategoryId:category.id,shopifyCategoryName:category.name}));setCategorySearch(category.name);setCategoryResults([]);}}>{category.name}</button>)}</div>}{form.shopifyCategoryId&&<div className="consignment-selected-category"><span>{form.shopifyCategoryName}</span><button type="button" className="consignment-batch-remove" aria-label="Remove Shopify category" onClick={()=>{setForm((current)=>({...current,shopifyCategoryId:'',shopifyCategoryName:''}));setCategorySearch('');}}><X size={13}/></button></div>}</div><div className="consignment-field wide"><label className="consignment-label">Product description</label><textarea className="consignment-textarea" rows={3} value={form.productDescription} onChange={set('productDescription')} placeholder="Shown to customers on Shopify"/></div><div className="consignment-field"><label className="consignment-label">SEO title</label><input className="consignment-input" value={form.seoTitle} onChange={set('seoTitle')} placeholder="Defaults to item title"/></div><div className="consignment-field"><label className="consignment-label">SEO description</label><textarea className="consignment-textarea" rows={2} value={form.seoDescription} onChange={set('seoDescription')} placeholder="Optional search description"/></div></div></div>;
}

function ManualItemCore({
  form,
  setForm,
  onSave,
  saveLabel = 'Save manual item',
  saveDisabled = false,
  helperText = 'Saves only the consignment metaobject record. No Shopify product is created.',
}) {
  const set = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const setCategory = (category) => {
    setForm((current) => ({
      ...current,
      category,
      type: '',
    }));
  };

  return (
    <>
      <div className="consignment-form-grid consignment-form-grid-2">
        <div className="consignment-form-field">
          <label className="consignment-label">
            Item description *
          </label>

          <input
            className="consignment-input"
            value={form.description}
            onChange={set('description')}
            placeholder="What is it?"
          />
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">
            Price *
          </label>

          <input
            className="consignment-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.price}
            onChange={set('price')}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="consignment-form-grid consignment-form-grid-2">
        <div className="consignment-form-field">
          <label className="consignment-label">
            Category
          </label>

          <select
            className="consignment-select"
            value={form.category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">
            Brand
          </label>

          <input
            className="consignment-input"
            value={form.brand}
            onChange={set('brand')}
            placeholder="e.g. Gap"
          />
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">
            Size
          </label>

          <input
            className="consignment-input"
            value={form.size}
            onChange={set('size')}
            placeholder="Optional"
          />
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">
            Condition
          </label>

          <select
            className="consignment-select"
            value={form.condition}
            onChange={set('condition')}
          >
            {CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">
            Consignment term
          </label>

          <select
            className="consignment-select"
            value={form.consignmentTerm || ''}
            onChange={set('consignmentTerm')}
          >
            <option value="">No term</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </div>

        <div className="consignment-form-field">
          <label className="consignment-label">
            Internal notes
          </label>

          <textarea
            className="consignment-textarea"
            rows={2}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Notes about this consigned item"
          />
        </div>
      </div>

      <div className="consignment-form-help">
        {helperText}
      </div>

      <div
        className="consignment-form-actions-inner"
        style={{ marginBottom: 14 }}
      >
        <button
          className="consignment-btn"
          disabled={saveDisabled}
          onClick={onSave}
        >
          <Check size={18} />
          {saveLabel}
        </button>
      </div>
    </>
  );
}
function productAdminUrl(productId){const numericId=String(productId||'').split('/').pop();return `shopify://admin/products/${numericId}`;}
function ShopifyProductSection({
  shopifyForm,
  setShopifyForm,
  linkedProductId = '',
  linkedStatus = '',
  disabled = false,
  onSync = null,
  syncing = false,
  tier2Enabled = true,
}) {
  const canSync = Boolean(onSync) && tier2Enabled;

  if (!tier2Enabled) {
    return (
      <section className="consignment-form-section">
        <div className="consignment-form-section-head consignment-shopify-summary consignment-shopify-locked">
          <span>
            <span
              className="consignment-form-section-marker"
              aria-hidden="true"
            />
            <ShoppingBag size={17} />
            <h2>Shopify product</h2>
          </span>

          <span className="consignment-row-sub">
            Requires Manual + Shopify Sync plan
          </span>
        </div>
      </section>
    );
  }

  return (
    <details className="consignment-form-section">
      <summary className="consignment-form-section-head consignment-shopify-summary">
        <span>
          <span
            className="consignment-form-section-marker"
            aria-hidden="true"
          />
          <ShoppingBag size={17} />
          <h2>Shopify product</h2>
        </span>

        <span className="consignment-row-sub">
          {!tier2Enabled
            ? 'Requires Manual + Shopify Sync plan'
            : linkedProductId
              ? 'Connected'
              : 'Separate optional workflow'}
        </span>
      </summary>

      <div className="consignment-form-section-body">
        <fieldset
          disabled={disabled}
          style={{
            minWidth: 0,
            margin: 0,
            padding: 0,
            border: 0,
            opacity: disabled ? 0.45 : 1,
          }}
        >
        <p className="consignment-shopify-help">
          This section only controls the linked Shopify product. Manual item
          saving never creates or updates a Shopify product.
        </p>

        <div className="consignment-shopify-photo-row">
          <PhotoPicker
            value={shopifyForm.photo}
            onChange={(value) =>
              setShopifyForm((current) => ({
                ...current,
                photo: value,
                photoId: null,
              }))
            }
            onChooseShopify={(file) =>
              setShopifyForm((current) => ({
                ...current,
                photo: file.url,
                photoId: file.id,
              }))
            }
          />

          <ShopifyProductFields
            form={shopifyForm}
            setForm={setShopifyForm}
          />
        </div>

        <label className="consignment-product-choice">
          <input
            type="checkbox"
            checked={shopifyForm.publishToPos !== false}
            onChange={(event) =>
              setShopifyForm((current) => ({
                ...current,
                publishToPos: event.target.checked,
              }))
            }
          />
          <span>
            <strong>Create Shopify POS Product</strong>
            <span>
              Creates or updates an Active product with inventory of one and
              publishes it to Point of Sale.
            </span>
          </span>
        </label>

        <label className="consignment-product-choice online">
          <input
            type="checkbox"
            checked={shopifyForm.publishOnline === true}
            onChange={(event) =>
              setShopifyForm((current) => ({
                ...current,
                publishOnline: event.target.checked,
              }))
            }
          />
          <span>
            <strong>Also publish to Online Store</strong>
            <span>Publishes the same synced product to the Online Store.</span>
          </span>
        </label>

        {linkedProductId && (
          <p
            style={{
              margin: '12px 0 0',
              color: 'var(--green-dark)',
              fontSize: 12,
            }}
          >
            <Check
              size={14}
              style={{ verticalAlign: 'middle', marginRight: 5 }}
            />
            Linked Shopify product Â· {linkedStatus || 'Connected'}
          </p>
        )}

        {!linkedProductId ? (
          <button
            className="consignment-btn"
            style={{ marginTop: 14 }}
            disabled={
              !canSync ||
              disabled ||
              syncing ||
              shopifyForm.publishToPos === false
            }
            onClick={onSync}
          >
            {syncing ? (
              <Loader2 className="consignment-spin" size={16} />
            ) : (
              <ShoppingBag size={16} />
            )}
            Create Shopify product
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 14,
            }}
          >
            <button
              className="consignment-btn"
              disabled={
                !canSync ||
                disabled ||
                syncing ||
                shopifyForm.publishToPos === false
              }
              onClick={onSync}
            >
              {syncing ? (
                <Loader2 className="consignment-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Update Shopify product
            </button>

            {disabled ? (
              <span
                className="consignment-btn secondary"
                aria-disabled="true"
              >
                <span aria-hidden="true">↗</span>
                Edit in Shopify
              </span>
            ) : (
              <a
                className="consignment-btn secondary"
                href={productAdminUrl(linkedProductId)}
                target="_top"
              >
                <span aria-hidden="true">↗</span>
                Edit in Shopify
              </a>
            )}
          </div>
        )}
        </fieldset>
      </div>
    </details>
  );
}

function IntakeScreen({
  consignor,
  items,
  onBack,
  onSaveBatch,
  onSaveAndSync,
  tier2Enabled = false,
}) {
  const emptyForm = {
    category: 'Clothing',
    type: '',
    description: '',
    size: '',
    condition: 'Good',
    price: '',
    brand: '',
    notes: '',
    consignmentTerm: '',
  };

  const emptyShopifyForm = {
    photo: null,
    photoId: null,
    shopifyTitle: '',
    shopifyPrice: '',
    tags: '',
    vendor: '',
    productDescription: '',
    shopifyCategoryId: '',
    shopifyCategoryName: '',
    seoTitle: '',
    seoDescription: '',
    publishToPos: true,
    publishOnline: false,
  };

  const [form, setForm] = useState(emptyForm);
  const [shopifyForm, setShopifyForm] = useState(emptyShopifyForm);
  const [syncing, setSyncing] = useState(false);

  const canSave = Boolean(
    form.description.trim() && form.price !== '',
  );

  const savedSequence = items
    .filter(
      (item) =>
        item.consignorId === consignor.id &&
        item.itemNumber.startsWith(`${consignor.number}-`),
    )
    .reduce(
      (maximum, item) =>
        Math.max(
          maximum,
          Number(item.itemNumber.split('-').pop()) || 0,
        ),
      0,
    );

  const nextItemNumber =
    `${consignor.number}-${String(savedSequence + 1).padStart(3, '0')}`;

  useEffect(() => {
    const auto = buildShopifyAutoFill(form, consignor);

    setShopifyForm((current) => ({
      ...current,
      ...auto,
      shopifyCategoryId: current.shopifyCategoryId,
      shopifyCategoryName: current.shopifyCategoryName,
      photo: current.photo,
      photoId: current.photoId,
      publishToPos: current.publishToPos,
      publishOnline: current.publishOnline,
    }));
  }, [
    form.description,
    form.price,
    form.brand,
    form.size,
    form.condition,
    form.category,
    form.type,
    consignor.number,
  ]);

  async function saveShopifyProduct() {
    setSyncing(true);

    try {
      /*
       * Shopify saving still receives an empty batch.
       * It saves this manual item first and then creates
       * the linked Shopify product.
       */
      await onSaveAndSync(form, [], shopifyForm);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <Header
        eyebrow={`For ${consignor.firstName} ${consignor.lastName} Â· #${consignor.number}`}
        title="Add item"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-form-shell">
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span
                className="consignment-form-section-marker"
                aria-hidden="true"
              />

         <div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  }}
>
  <h2>Manual consignment item</h2>

  <span
    style={{
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--green-dark)',
    }}
  >
    Item {nextItemNumber}
  </span>
</div>
            </div>

            <div className="consignment-form-section-body">
              <ManualItemCore
                form={form}
                setForm={setForm}
                onSave={() => onSaveBatch([form])}
                saveDisabled={!canSave}
                saveLabel="Save manual item"
              />

              {/*
                ADD ANOTHER MANUAL ITEM IS INTENTIONALLY HIDDEN.

                Do not comment out IntakeScreen.
                If the button is needed again, put the button here.
              */}
            </div>
          </section>

          <ShopifyProductSection
            shopifyForm={shopifyForm}
            setShopifyForm={setShopifyForm}
            tier2Enabled={tier2Enabled}
            syncing={syncing}
            onSync={canSave ? saveShopifyProduct : null}
          />
        </div>
      </div>
    </>
  );
}
function EditItemScreen({
  item,
  onBack,
  onSave,
  onDelete,
  onSyncProduct,
  onUpdateStatus,
  onOpenPayoutReceipt,
  onStartPayout,
  tier2Enabled = false,
}) {
  const [form, setForm] = useState({
    category: item.category || 'Other',
    type: '',
    description: item.description || '',
    size: item.size || '',
    condition: item.condition || 'Good',
    price: item.price ?? '',
    brand: item.brand || '',
    notes: item.notes || '',
    consignmentTerm: item.consignmentTerm || '',
  });
  const [shopifyForm, setShopifyForm] = useState({
    photo: item.shopifyPhoto || item.photo || null,
    photoId: item.photoId || null,
    shopifyTitle: item.shopifyTitle || '',
    shopifyPrice: item.shopifyPrice ?? item.price ?? '',
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
    vendor: item.vendor || '',
    productDescription: item.productDescription || '',
    shopifyCategoryId: item.shopifyCategoryId || '',
    shopifyCategoryName: item.shopifyCategoryName || '',
    seoTitle: item.seoTitle || '',
    seoDescription: item.seoDescription || '',
    publishToPos: true,
    publishOnline: item.publishOnline === true,
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const isSold = item.status === 'Sold' || Boolean(item.dateSold);
  const canSave = form.description.trim() && form.price !== '';

  useEffect(() => {
    if (item.shopifyProductId) return;
    const auto = buildShopifyAutoFill(form);
    setShopifyForm((current) => ({
      ...current,
      ...auto,
      shopifyCategoryId: current.shopifyCategoryId,
      shopifyCategoryName: current.shopifyCategoryName,
      photo: current.photo,
      photoId: current.photoId,
      publishToPos: current.publishToPos,
      publishOnline: current.publishOnline,
    }));
  }, [
    form.description,
    form.price,
    form.brand,
    form.size,
    form.condition,
    form.category,
    form.type,
    item.shopifyProductId,
  ]);

  return (
    <>
      <Header
        eyebrow={`Item ${item.itemNumber}`}
        title="Item details"
        onBack={onBack}
      />

      <div className="consignment-body">
        <div className="consignment-form-shell">
          {tier2Enabled && (
            <ItemBarcode
              value={item.itemNumber}
              description={item.description || item.type || 'Consignment item'}
              priceLabel={money(item.price)}
            />
          )}

          <ManualSaleStatus
            item={item}
            allowManualSale={!tier2Enabled}
            onMarkSold={(itemId, details) =>
              onUpdateStatus(itemId, 'Sold', details)
            }
            money={money}
            onStartPayout={onStartPayout}
            onOpenPayoutReceipt={onOpenPayoutReceipt}
          />

          <details className="consignment-form-section">
            <summary className="consignment-form-section-head">
              <span className="consignment-form-section-marker" />
              <div>
                <h2>Product information</h2>
                <p>Item {item.itemNumber}</p>
              </div>
            </summary>

            <div className="consignment-form-section-body">
              <fieldset
                disabled={isSold}
                style={{
                  minWidth: 0,
                  margin: 0,
                  padding: 0,
                  border: 0,
                  opacity: isSold ? 0.45 : 1,
                }}
              >
                <ManualItemCore
                  form={form}
                  setForm={setForm}
                  onSave={() => onSave(item.id, form)}
                  saveDisabled={!canSave || isSold}
                  saveLabel="Save manual changes"
                  helperText="Updates only the consignment item metaobject. Shopify product data and media are handled separately below."
                />
              </fieldset>
            </div>
          </details>

          <ShopifyProductSection
            shopifyForm={shopifyForm}
            setShopifyForm={setShopifyForm}
            linkedProductId={item.shopifyProductId}
            linkedStatus={item.shopifyProductStatus}
            disabled={isSold}
            syncing={syncing}
            tier2Enabled={tier2Enabled}
            onSync={async () => {
              setSyncing(true);
              try {
                await onSyncProduct(item.id, shopifyForm);
              } finally {
                setSyncing(false);
              }
            }}
          />

          {!confirmingDelete ? (
            <button
              className="consignment-btn secondary"
              style={{
                color: 'var(--danger)',
                borderColor: 'var(--danger-soft)',
              }}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={16} />
              Delete item
            </button>
          ) : (
            <div
              className="consignment-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13 }}>
                Delete {item.itemNumber} and its linked Shopify product?
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="consignment-btn secondary"
                  style={{ padding: '8px 14px' }}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className="consignment-btn danger"
                  style={{ padding: '8px 14px' }}
                  onClick={() => onDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ConsignmentIntakeApp({ activePlan = null }) {
  const tier2Enabled=activePlan==='TIER2'; const [ready,setReady]=useState(false); const [consignors,setConsignors]=useState([]); const [items,setItems]=useState([]); const [view,setView]=useState('dashboard'); const [activeId,setActiveId]=useState(null); const [activeItemId,setActiveItemId]=useState(null); const [query,setQuery]=useState(''); const [newConsignorNext,setNewConsignorNext]=useState('consignor'); const [newConsignorBack,setNewConsignorBack]=useState('home'); const [importKind,setImportKind]=useState('consignors'); const [importBack,setImportBack]=useState('home'); const [importConsignorId,setImportConsignorId]=useState(null); const [toast,setToast]=useState(''); const [toastTone,setToastTone]=useState(''); const [error,setError]=useState(''); const [showBackToTop,setShowBackToTop]=useState(false); const [payoutReceipt,setPayoutReceipt]=useState(null); const [payoutReceiptBackView,setPayoutReceiptBackView]=useState('payouts');
  function errorMessage(value,fallback){return value instanceof Error?value.message:fallback;} async function refreshData(){const data=await getConsignmentData();setConsignors(data.consignors);setItems(data.items);return data;}
  useEffect(()=>{refreshData().catch((e)=>setError(errorMessage(e,'Could not load Shopify data'))).finally(()=>setReady(true));},[]); 
  
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'auto'});document.querySelector('.consignment-body')?.scrollTo({top:0,left:0,behavior:'auto'});setShowBackToTop(false);},[view]);
  useEffect(()=>{if(!ready)return undefined;const body=document.querySelector('.consignment-body');const updateBackToTop=()=>setShowBackToTop(window.scrollY>280||(body?.scrollTop||0)>280);updateBackToTop();window.addEventListener('scroll',updateBackToTop,{passive:true});body?.addEventListener('scroll',updateBackToTop,{passive:true});return()=>{window.removeEventListener('scroll',updateBackToTop);body?.removeEventListener('scroll',updateBackToTop);};},[ready,view]);
  function scrollToTop(){window.scrollTo({top:0,left:0,behavior:'smooth'});document.querySelector('.consignment-body')?.scrollTo({top:0,left:0,behavior:'smooth'});} function flash(msg,tone=''){setToast(msg);setToastTone(tone);setTimeout(()=>{setToast('');setToastTone('');},2000);}
  async function handleNewConsignor(form){try{setError('');const consignor=await createConsignor(form);await refreshData();flash(`Consignor #${consignor.number} added`);setActiveId(consignor.id);setView(newConsignorNext);}catch(e){setError(errorMessage(e,'Could not save consignor'));}}
  async function handleImport(kind,rows){try{setError('');const result=await importConsignmentData(kind,rows);await refreshData();if(kind==='consignors')flash(`${result.consignorsCreated||0} created, ${result.consignorsUpdated||0} matched/updated, ${result.itemsImported||0} items imported, ${result.shopifyProductsCreated||0} Shopify products created`);else{const importedCount=result.itemsImported??result.imported;flash(`${importedCount} item${importedCount===1?'':'s'} imported, ${result.shopifyProductsCreated||0} Shopify products created`);}setView(importBack);}catch(e){setError(errorMessage(e,'Could not import this CSV'));throw e;}}
  function startImport(kind,backView,consignorId=null){setImportKind(kind);setImportBack(backView);setImportConsignorId(consignorId);setView('import');}
  async function handleSaveBatch(batch){try{setError('');const saved=await createConsignmentItems(activeId,batch);await refreshData();flash(`${saved.length} item${saved.length===1?'':'s'} saved`);setView('consignor');}catch(e){setError(errorMessage(e,'Could not save items'));}}
  async function handleSaveAndSync(currentEntry,queuedBatch,shopifyForm){try{setError('');const saved=await createConsignmentItems(activeId,[...queuedBatch,currentEntry]);const newItem=saved[saved.length-1];await syncShopifyProduct(newItem.id,shopifyForm);await refreshData();flash(`${saved.length} item${saved.length===1?'':'s'} saved Ã‚Â· Shopify product created`);setActiveItemId(newItem.id);setView('editItem');}catch(e){setError(errorMessage(e,'Could not save the item and create the Shopify product'));throw e;}}
  async function handleUpdateConsignor(consignorId,form){try{setError('');await updateConsignor(consignorId,form);await refreshData();flash('Consignor updated');setView('consignor');}catch(e){setError(errorMessage(e,'Could not update consignor'));}}
  async function handleDeleteConsignor(consignorId){try{setError('');await deleteConsignor(consignorId);await refreshData();setActiveId(null);setView('home');flash('Consignor deleted');}catch(e){setError(errorMessage(e,'Could not delete consignor'));}}
  async function handleDeleteItem(itemId){try{setError('');await deleteConsignmentItem(itemId);await refreshData();flash('Item deleted');}catch(e){setError(errorMessage(e,'Could not delete item'));}}
  async function handleUpdateItem(itemId,form){try{setError('');await updateConsignmentItem(itemId,form);await refreshData();flash('Item updated');setView('consignor');}catch(e){setError(errorMessage(e,'Could not update item'));}}
async function handleUpdateItemStatus(itemId,status,details={}){
  try{
    setError('');
    await updateConsignmentItemStatus(itemId,status,details);
    await refreshData();
    flash(
      status === 'Paid'
        ? 'Item marked paid'
        : status === 'Sold'
          ? 'Item marked sold - unpaid'
          : 'Item returned to available'
    );
  }catch(e){
    setError(errorMessage(e,'Could not update item status'));
    throw e;
  }
}  async function handleSyncProduct(itemId,shopifyForm){try{setError('');const wasAlreadyLinked=Boolean(items.find((entry)=>entry.id===itemId)?.shopifyProductId);await syncShopifyProduct(itemId,shopifyForm);await refreshData();flash(wasAlreadyLinked?'Your product has been updated':'Shopify product created','success');}catch(e){setError(errorMessage(e,'Could not sync the Shopify product'));throw e;}}
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
  async function handleDeleteItemFromEdit(itemId){await handleDeleteItem(itemId);setView('consignor');}
  const activeConsignor=consignors.find((c)=>c.id===activeId); const activeItem=items.find((i)=>i.id===activeItemId); const nextConsignorNumber=Math.max(0,...consignors.map((consignor)=>Number(consignor.number)||0))+1; const navigationView=['newConsignor','chooseConsignor','consignor','intake','editConsignor'].includes(view)?'home':view==='editItem'?'items':['createPayout','payoutReceipt'].includes(view)?'payouts':view;
  function navigate(viewName){setError('');setView(viewName);} function openConsignor(id){setActiveId(id);setView('consignor');} function openItem(id){const item=items.find((entry)=>entry.id===id);setActiveItemId(id);if(item?.consignorId)setActiveId(item.consignorId);setView('editItem');} function startNewConsignor(nextView='consignor',backView='home'){setNewConsignorNext(nextView);setNewConsignorBack(backView);setView('newConsignor');} function startNewItem(){if(!consignors.length){startNewConsignor('intake','dashboard');return;}setView('chooseConsignor');}
  return <div className="consignment">{ready&&<AppNavigation view={navigationView} onNavigate={navigate}/>} {toast&&<div className="consignment-toast" style={toastTone==='success'?{background:'#1C7A3E'}:undefined}><Check size={14}/> {toast}</div>} {error&&<div className="consignment-toast" style={{ background:'var(--danger)',top:12 }}><X size={14}/> {error}</div>} {!ready&&<div className="consignment-loading"><Loader2 className="consignment-spin" size={22}/></div>}
  {ready&&view==='dashboard'&&<DashboardScreen consignors={consignors} items={items} onOpenConsignor={openConsignor} onNavigate={navigate} onNewConsignor={()=>startNewConsignor('consignor','dashboard')} onNewItem={startNewItem} onImport={()=>startImport('consignors','dashboard')} onExport={()=>exportConsignors(consignors)}/>} {ready&&view==='home'&&<ConsignorsScreen consignors={consignors} items={items} query={query} setQuery={setQuery} tier2Enabled={tier2Enabled} onOpenConsignor={openConsignor} onOpenItem={openItem} onMarkSold={(itemId,details)=>handleUpdateItemStatus(itemId,'Sold',details)} onStartPayout={(consignorId)=>{setActiveId(consignorId);setView('createPayout');}} onNewConsignor={()=>startNewConsignor('consignor','home')} onNewItem={startNewItem} onImport={()=>startImport('consignors','home')} onExport={()=>exportConsignors(consignors)}/>} {ready&&view==='items'&&<ItemsScreen items={items} consignors={consignors} tier2Enabled={tier2Enabled} onOpenItem={openItem} onOpenConsignor={openConsignor} onMarkSold={(itemId,details)=>handleUpdateItemStatus(itemId,'Sold',details)} onStartPayout={(consignorId)=>{setActiveId(consignorId);setView('createPayout');}} onNewItem={startNewItem}/>} {ready&&view==='sales'&&<SalesScreen items={items} consignors={consignors} tier2Enabled={tier2Enabled} onOpenItem={openItem} onOpenConsignor={openConsignor} onStartPayout={(consignorId)=>{setActiveId(consignorId);setView('createPayout');}}/>} {ready&&view==='payouts'&&<PayoutsScreen items={items} consignors={consignors} tier2Enabled={tier2Enabled} onOpenItem={openItem} onOpenConsignor={openConsignor} onStartPayout={(consignorId)=>{setActiveId(consignorId);setView('createPayout');}}/>} {ready&&view==='reports'&&<ReportsScreen items={items} consignors={consignors} onOpenConsignor={openConsignor} onStartPayout={(consignorId)=>{setActiveId(consignorId);setView('createPayout');}}/>}
  {ready&&view==='createPayout'&&activeConsignor&&<CreatePayoutScreen consignor={activeConsignor} items={items} onBack={()=>setView('payouts')} onRecordPayout={handleRecordPayout}/>} {ready&&view==='payoutReceipt'&&payoutReceipt&&<PayoutReceiptScreen receipt={payoutReceipt} onBack={()=>setView(payoutReceiptBackView)} onOpenConsignor={()=>{setActiveId(payoutReceipt.consignor.id);setView('consignor');}}/>} {ready&&view==='import'&&<ImportScreen kind={importKind} fixedConsignor={consignors.find((entry)=>entry.id===importConsignorId)||null} onBack={()=>setView(importBack)} onImport={handleImport}/>} {ready&&view==='newConsignor'&&<CreateConsignorScreen onBack={()=>setView(newConsignorBack)} onSave={handleNewConsignor} nextNumber={nextConsignorNumber}/>} {ready&&view==='chooseConsignor'&&<ChooseConsignorScreen consignors={consignors} onBack={()=>setView('dashboard')} onChoose={(consignorId)=>{setActiveId(consignorId);setView('intake');}} onCreate={()=>startNewConsignor('intake','chooseConsignor')}/>} {ready&&view==='consignor'&&activeConsignor&&<ConsignorDashboard consignor={activeConsignor} items={items} onBack={()=>setView('home')} onStartIntake={()=>setView('intake')} onOpenItem={openItem} onDeleteConsignor={handleDeleteConsignor} onEditConsignor={()=>setView('editConsignor')} onStartPayout={(consignorId)=>{setActiveId(consignorId);setView('createPayout');}}/>} {ready&&view==='editConsignor'&&activeConsignor&&<EditConsignorScreen consignor={activeConsignor} onBack={()=>setView('consignor')} onSave={handleUpdateConsignor}/>} {ready&&view==='intake'&&activeConsignor&&<IntakeScreen consignor={activeConsignor} items={items} onBack={()=>setView('consignor')} onSaveBatch={handleSaveBatch} onSaveAndSync={handleSaveAndSync} tier2Enabled={tier2Enabled}/>} {ready&&view==='editItem'&&activeItem&&<EditItemScreen item={activeItem} onBack={()=>setView('consignor')} onSave={handleUpdateItem} onDelete={handleDeleteItemFromEdit} onSyncProduct={handleSyncProduct} onUpdateStatus={handleUpdateItemStatus} onOpenPayoutReceipt={(payoutId)=>openPayoutReceipt(payoutId,'editItem')} onStartPayout={(consignorId)=>{setActiveId(consignorId);setView('createPayout');}} tier2Enabled={tier2Enabled}/>} {ready&&showBackToTop&&<button className="consignment-back-to-top" type="button" onClick={scrollToTop} aria-label="Back to top" title="Back to top"><ArrowUp size={20} aria-hidden="true"/></button>}</div>;
}
