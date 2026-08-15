/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState, useEffect } from 'react';
import {
  Search, Plus, ArrowLeft, Camera, X, ChevronRight, ChevronDown, Phone, Mail,
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
  updateConsignmentItem,
  updateConsignmentItemStatus,
  updateConsignor,
  importConsignmentData,
} from './consignmentApi';
import ReportsScreen from './reports';

/* ---------- image helper ---------- */

function resizeImage(file, maxWidth = 320, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result !== 'string') {
        reject(new Error('Could not read this image'));
        return;
      }
      const img = new Image();
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
  'Clothing', 'Shoes', 'Jewellery', 'Handbags', 'Home Décor', 'Furniture',
  'Electronics', 'Appliances', 'Books', 'Movies & Music', 'Video Games',
  'Collectibles', 'Sporting Goods', 'Tools', 'Toys', 'Baby Gear',
  'Pet Supplies', 'Outdoor & Garden', 'Art', 'Automotive', 'Other',
];
const CONDITIONS = ['New with tags', 'Like new', 'Good', 'Fair'];
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

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

function saleSourceLabel(item) {
  if (!(item?.status === 'Sold' || item?.dateSold)) return null;

  const source = String(item.saleSource || '').trim().toLowerCase();
  if (source === 'pos' || source.includes('point of sale')) {
    return { text: 'Sold via POS', className: 'pos' };
  }
  if (source === 'online' || source === 'web' || source.includes('online')) {
    return { text: 'Sold Online', className: 'online' };
  }
  if (source === 'manual') {
    return { text: 'Manual Sale', className: 'manual' };
  }

  // Older sales recorded before sale-source tracking:
  // no Shopify order means it was marked sold manually in JustConsignIn.
  if (!item.orderId && !item.orderName) {
    return { text: 'Manual Sale', className: 'manual' };
  }

  return { text: 'Shopify Sale', className: 'draft' };
}

/* ---------- shared styles ---------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');

      .consignment {
        --bg: #F6F6F7;
        --surface: #FFFFFF;
        --ink: #202223;
        --muted: #6D7175;
        --green: #1D5FA8;
        --green-dark: #143F73;
        --green-soft: #E4EEF9;
        --gold: #B98900;
        --gold-soft: #FFF4D6;
        --line: #E1E3E5;
        --danger: #B42318;
        --danger-soft: #FEE4E2;
        /* Aliases — some newer components reference these names instead of
           the ones above. Keeping both in sync avoids invisible borders/
           buttons if a rule uses the other name. */
        --text: var(--ink);
        --border: var(--line);
        --blue: var(--green);
        --blue-soft: var(--green-soft);
        font-family: 'Inter', system-ui, sans-serif;
        background: var(--bg);
        color: var(--ink);
        min-height: 100vh;
        width: 100%;
        max-width: 1240px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      .consignment * { box-sizing: border-box; }
      .consignment h1, .consignment h2, .consignment h3 {
        font-family: 'Fraunces', serif;
        margin: 0;
        color: var(--ink);
      }
      .consignment button { font-family: inherit; cursor: pointer; }
      .consignment input, .consignment select, .consignment textarea {
        font-family: inherit;
        font-size: 16px;
      }
      .consignment ::placeholder { color: #A6AC9B; }

      .consignment-header {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg);
        padding: 22px 24px 14px;
        border-bottom: 1px solid var(--line);
      }
      .consignment-header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .consignment-header-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .consignment-header-action { flex-shrink: 0; }
      .consignment-header-action .consignment-btn {
        min-width: 0; padding: 10px 14px; border-radius: 9px; box-shadow: none;
      }
      .consignment-back {
        display: flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; border-radius: 999px;
        border: 1px solid var(--line); background: var(--surface);
        color: var(--ink); flex-shrink: 0;
      }
      .consignment-back:active { background: var(--green-soft); }
      .consignment-eyebrow {
        font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
        color: var(--green); font-weight: 600; margin: 0 0 2px;
      }
      .consignment-title { font-family: 'Inter', system-ui, sans-serif !important; font-size: 24px; font-weight: 700; line-height: 1.15; }

      .consignment-body { flex: 1; overflow-y: auto; padding: 20px 24px 110px; }

      .consignment-back-to-top {
        position: fixed; right: max(18px, calc((100vw - 1240px) / 2 + 18px));
        bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 40;
        display: inline-flex; align-items: center; justify-content: center;
        width: 44px; height: 44px; min-width: 44px; padding: 0; border: 0; border-radius: 50%;
        background: var(--green); color: #fff;
        box-shadow: 0 6px 18px rgba(20,63,115,.28);
      }
      .consignment-back-to-top:hover { background: var(--green-dark); }
      .consignment-back-to-top:focus-visible { outline: 3px solid var(--green-soft); outline-offset: 2px; }

      .consignment-search {
        display: flex; align-items: center; gap: 8px;
        background: var(--surface); border: 1px solid var(--line);
        border-radius: 14px; padding: 11px 14px; margin-bottom: 14px;
      }
      .consignment-search input { border: none; outline: none; flex: 1; background: transparent; color: var(--ink); }
      .consignment-search svg { color: var(--muted); flex-shrink: 0; }

      .consignment-card {
        background: var(--surface); border: 1px solid var(--line);
        border-radius: 12px; padding: 16px; margin-bottom: 12px;
        box-shadow: 0 1px 0 rgba(0,0,0,.03);
      }
      .consignment-row-btn {
        width: 100%; text-align: left; display: flex; align-items: center;
        gap: 12px; background: var(--surface); border: 1px solid var(--line);
        border-radius: 12px; padding: 14px 14px; margin-bottom: 10px;
        transition: background .15s;
      }
      .consignment-row-btn:active { background: var(--green-soft); }

      .consignment-avatar {
        width: 42px; height: 42px; border-radius: 12px; background: var(--green-soft);
        color: var(--green-dark); display: flex; align-items: center; justify-content: center;
        font-family: 'Fraunces', serif; font-weight: 600; font-size: 16px; flex-shrink: 0;
      }
      .consignment-row-main { flex: 1; min-width: 0; }
      .consignment-row-name { font-weight: 600; font-size: 15px; }
      .consignment-row-sub { font-size: 13px; color: var(--muted); margin-top: 1px; }
      .consignment-chev { color: var(--muted); flex-shrink: 0; }

      .consignment-consignor-row { margin-bottom: 10px; }
      .consignment-consignor-row-summary {
        width: 100%; display: flex; align-items: center; gap: 12px;
        background: var(--surface); border: 1px solid var(--line);
        border-radius: 12px; padding: 14px 14px; cursor: pointer;
        list-style: none; transition: background .15s;
      }
      .consignment-consignor-row-summary::-webkit-details-marker { display: none; }
      .consignment-consignor-row-summary:active { background: var(--green-soft); }
      .consignment-consignor-row-name {
        display: block; padding: 0; border: 0; background: none;
        font-family: inherit; font-weight: 600; font-size: 15px; color: var(--ink);
        text-align: left; cursor: pointer;
      }
      .consignment-consignor-row-name:hover { text-decoration: underline; color: var(--green); }
      .consignment-consignor-row-chevron { color: var(--muted); flex-shrink: 0; transition: transform .15s; }
      .consignment-consignor-row[open] .consignment-consignor-row-summary { border-radius: 12px 12px 0 0; border-bottom: 0; }
      .consignment-consignor-row[open] .consignment-consignor-row-chevron { transform: rotate(180deg); }
      .consignment-consignor-row-items {
        border: 1px solid var(--line); border-top: 0; border-radius: 0 0 12px 12px;
        background: #fff; padding: 6px 10px;
      }
      .consignment-consignor-row-item {
        display: flex; align-items: center; gap: 10px; padding: 9px 4px;
        border-bottom: 1px solid var(--line);
      }
      .consignment-consignor-row-item:last-child { border-bottom: 0; }
      .consignment-consignor-row-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .consignment-consignor-row-item-main strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .consignment-consignor-row-item-main small { font-size: 11px; color: var(--muted); }
      .consignment-consignor-row-item-price { font-size: 13px; flex-shrink: 0; }

      .consignment-empty {
        text-align: center; padding: 60px 20px; color: var(--muted);
      }
      .consignment-empty h3 { font-size: 17px; margin-bottom: 6px; color: var(--ink); }
      .consignment-empty p { font-size: 14px; margin: 0; }

      .consignment-fab-wrap {
        position: sticky; bottom: 0; left: 0; right: 0; z-index: 15;
        padding: 14px 24px calc(14px + env(safe-area-inset-bottom));
        background: linear-gradient(to top, var(--bg) 60%, transparent);
      }
      .consignment-btn {
        width: auto; min-width: 180px; display: flex; align-items: center; justify-content: center;
        gap: 8px; background: var(--green); color: #fff; border: none;
        border-radius: 10px; padding: 13px 18px; font-weight: 600; font-size: 14px;
        box-shadow: 0 6px 16px rgba(47,107,79,0.25); text-decoration: none;
      }
      .consignment-btn:active { background: var(--green-dark); }
      .consignment-btn.secondary {
        background: var(--surface); color: var(--green-dark); border: 1px solid var(--line);
        box-shadow: none;
      }
      .consignment-btn.secondary:active { background: var(--green-soft); }
      .consignment-btn.danger { background: var(--danger); box-shadow: 0 6px 16px rgba(179,73,47,0.25); }
      .consignment-btn:disabled { opacity: .5; }

      .consignment-field { margin-bottom: 14px; }
      .consignment-label {
        display: block; font-size: 12px; font-weight: 600; color: var(--muted);
        text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px;
      }
      .consignment-input, .consignment-select, .consignment-textarea {
        width: 100%; border: 1px solid var(--line); border-radius: 12px;
        padding: 12px 14px; background: var(--surface); color: var(--ink); outline: none;
      }
      .consignment-input:focus, .consignment-select:focus, .consignment-textarea:focus {
        border-color: var(--green); box-shadow: 0 0 0 3px var(--green-soft);
      }
      .consignment-row2 { display: flex; gap: 10px; }
      .consignment-row2 > * { flex: 1; }
      .consignment-section-heading {
        display: flex; align-items: center; justify-content: space-between;
        gap: 14px; margin: 0 0 8px;
      }
      .consignment-section-heading .consignment-label { margin: 0; }
      .consignment-item-number {
        flex: 0 0 auto; color: var(--green-dark); font-size: 22px;
        font-weight: 800; letter-spacing: .02em;
      }
      .consignment-detail-card { margin-top: 14px; }
      .consignment-detail-grid {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .consignment-detail-grid .consignment-field { min-width: 0; margin: 0; }
      .consignment-detail-grid .consignment-field.wide { grid-column: 1 / -1; }
      .consignment-shopify-section { margin-top: 14px; padding: 0; overflow: hidden; }
      .consignment-shopify-summary {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 15px 16px; cursor: pointer; list-style: none;
      }
      .consignment-shopify-summary::-webkit-details-marker { display: none; }
      .consignment-shopify-summary > span:first-child { display: flex; align-items: center; gap: 8px; }
      .consignment-shopify-summary::after { content: '⌄'; color: var(--muted); font-size: 18px; line-height: 1; }
      details[open] > .consignment-shopify-summary::after { transform: rotate(180deg); }
      .consignment-shopify-content { padding: 0 16px 16px; border-top: 1px solid var(--line); }
      .consignment-shopify-help { margin: 12px 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
      .consignment-shopify-fields { margin-top: 12px; }
      .consignment-shopify-edit-details { margin: -2px 0 14px; border-bottom: 1px solid var(--line); }
      .consignment-shopify-edit-details .consignment-shopify-summary { padding: 10px 0 14px; }
      .consignment-shopify-edit-details .consignment-shopify-content { padding: 0 0 14px; }
      .consignment-add-another { width: 100%; margin-top: 14px; }

      .consignment-consignor-number-card {
        display: grid; grid-template-columns: minmax(0, 1fr) 112px;
        gap: 14px; align-items: end; margin-bottom: 14px;
      }
      .consignment-consignor-number-preview {
        display: grid; place-items: center; min-height: 64px;
        border: 1px solid #C9DDCE; border-radius: 12px;
        background: var(--green-soft); color: var(--green-dark);
        font-size: 26px; font-weight: 800;
      }

      .consignment-chiprow { display: flex; flex-wrap: wrap; gap: 8px; }
      .consignment-chip {
        border: 1px solid var(--line); background: var(--surface); color: var(--ink);
        border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 500;
      }
      .consignment-chip.active { background: var(--green); border-color: var(--green); color: #fff; }
      .consignment-tab-count {
        display: inline-grid; place-items: center; min-width: 20px; height: 20px;
        margin-left: 4px; padding: 0 6px; border-radius: 999px;
        background: #E4E7EC; color: #344054; font-size: 11px; font-weight: 700;
      }
      .consignment-chip.active .consignment-tab-count { background: rgba(255,255,255,.2); color: #fff; }
      .consignment-product-choice {
        display: flex; align-items: flex-start; gap: 10px;
        margin-top: 14px; padding: 13px; border-radius: 12px;
        background: var(--gold-soft); border: 1px solid #EFD7A8;
        cursor: pointer;
      }
      .consignment-product-choice input {
        width: 19px; height: 19px; margin: 1px 0 0; accent-color: var(--green);
      }
      .consignment-product-choice strong { display: block; font-size: 13px; margin-bottom: 2px; }
      .consignment-product-choice span { display: block; color: var(--muted); font-size: 11px; line-height: 1.4; }
      .consignment-product-choice.online {
        margin-top: 8px; margin-left: 28px; background: var(--green-soft);
        border-color: #C9DDCE;
      }
      .consignment-product-card {
        margin-bottom: 14px; padding: 13px; border-radius: 14px;
        background: var(--green-soft); border: 1px solid #C9DDCE;
      }
      .consignment-product-card.disabled {
        background: #F1F2F3; border-color: var(--line); color: var(--muted);
        opacity: .72; pointer-events: none;
      }
      .consignment-status-card {
        border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px;
        background: var(--surface); margin: 0 0 14px;
      }
      .consignment-manual-sale {
        display: block;
      }
      .consignment-manual-sale-copy { margin-bottom: 10px; }
      .consignment-manual-sale-copy strong { display: block; font-size: 13px; }
      .consignment-manual-sale-copy span { display: block; color: var(--muted); font-size: 11px; margin-top: 2px; }
      .consignment-manual-sale-controls {
        display: grid; grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px; align-items: end;
      }
      .consignment-manual-sale .consignment-field { margin: 0; }
      .consignment-sold-btn {
        min-width: 0; width: auto; padding: 11px 16px; border-radius: 9px;
        box-shadow: none; white-space: nowrap;
      }
      .consignment-status-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .consignment-status-actions .consignment-btn { min-width: 0; box-shadow: none; padding: 9px 13px; }
      .consignment-sold-status {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; min-height: 42px;
      }
      .consignment-sold-status .consignment-row-sub { text-align: right; }

      .consignment-badge {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase;
        padding: 4px 9px; border-radius: 999px;
      }
      .consignment-badge.draft { background: var(--green-soft); color: var(--green-dark); }
      .consignment-badge.available, .consignment-badge.active { background: #DFF5E7; color: #17663A; }
      .consignment-badge.sold { background: #E4E7EC; color: #344054; }
      .consignment-badge.paid { background: #DFF5E7; color: #17663A; }
      .consignment-badge.unpaid { background: var(--gold-soft); color: #8A5D14; }
      .consignment-badge.returned, .consignment-badge.donated { background: #F2F4F7; color: #667085; }

      .consignment-main-nav {
        display: flex; align-items: center; gap: 4px; padding: 10px 24px;
        background: var(--surface); border-bottom: 1px solid var(--line);
        position: sticky; top: 0; z-index: 20;
      }
      .consignment-brand {
        display: flex; align-items: center; gap: 10px; margin-right: 24px;
        font-size: 15px; font-weight: 700; white-space: nowrap;
      }
      .consignment-brand-mark {
        display: grid; place-items: center; width: 34px; height: 34px;
        border-radius: 9px; background: var(--green); color: white;
      }
      .consignment-nav-button {
        display: flex; align-items: center; gap: 7px; padding: 9px 11px;
        border: 0; border-radius: 8px; background: transparent; color: var(--muted);
        font-size: 13px; font-weight: 600;
      }
      .consignment-nav-button:hover { background: #F1F2F3; color: var(--ink); }
      .consignment-nav-button.active { background: var(--green-soft); color: var(--green-dark); }
      .consignment-dashboard-grid {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;
        margin-bottom: 20px;
      }
      .consignment-metric {
        width: 100%; text-align: left; color: inherit; font: inherit;
        background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
        padding: 16px; min-height: 118px;
        transition: border-color .15s, box-shadow .15s, transform .15s;
      }
      .consignment-metric:hover { border-color: #AEB4B8; box-shadow: 0 4px 14px rgba(0,0,0,.06); transform: translateY(-1px); }
      .consignment-metric:focus-visible { outline: 3px solid var(--green-soft); border-color: var(--green); }
      .consignment-metric-icon {
        width: 34px; height: 34px; border-radius: 9px; background: var(--green-soft);
        color: var(--green-dark); display: grid; place-items: center; margin-bottom: 14px;
      }
      .consignment-metric-label { color: var(--muted); font-size: 12px; font-weight: 600; }
      .consignment-metric-value { font-size: 25px; font-weight: 700; margin-top: 4px; letter-spacing: -.02em; }
      .consignment-metric-note { color: var(--muted); font-size: 11px; margin-top: 4px; }
      .consignment-section-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .8fr); gap: 14px; }
      .consignment-section-title {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; margin: 4px 0 12px;
      }
      .consignment-section-title h2 { font-family: 'Inter', system-ui, sans-serif; font-size: 16px; font-weight: 700; }
      .consignment-link-button { border: 0; background: transparent; color: var(--green); font-size: 12px; font-weight: 600; }
      .consignment-toolbar {
        display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap;
      }
      .consignment-toolbar .consignment-search { margin: 0; flex: 1; min-width: 220px; }
      .consignment-filter-select { width: auto; min-width: 170px; padding: 10px 34px 10px 12px; font-size: 13px !important; }
      .consignment-page-toolbar { display:grid; grid-template-columns:minmax(240px,1fr) repeat(4,minmax(145px,auto)) auto; gap:10px; align-items:end; }
      .consignment-consignors-toolbar { grid-template-columns:minmax(260px,1fr) minmax(190px,260px) auto; }
      .consignment-page-toolbar .consignment-search { width:100%; min-height:42px; }
      .consignment-tool-field, .consignment-tool-view { min-width:0; }
      .consignment-tool-field > span, .consignment-tool-view > span { display:block; margin-bottom:6px; color:var(--muted); font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
      .consignment-tool-field .consignment-select { width:100%; min-width:0; min-height:42px; }
      .consignment-tool-view .consignment-view-toggle { min-height:42px; }
      .consignment-items-toolbar { grid-template-columns:minmax(240px,1fr) repeat(4,minmax(145px,auto)) auto; }
      .consignment-items-filter-details { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden; }
      .consignment-items-filter-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 12px 14px; list-style: none; color: var(--ink); font-size: 13px; font-weight: 700; cursor: pointer; }
      .consignment-items-filter-summary::-webkit-details-marker { display: none; }
      .consignment-items-filter-summary svg { color: var(--muted); transition: transform .15s; }
      .consignment-items-filter-details[open] .consignment-items-filter-summary svg { transform: rotate(180deg); }
      .consignment-items-filter-details .consignment-items-toolbar-top { padding: 12px 14px 14px; border-top: 1px solid var(--line); }
      .consignment-readable-card-sku { display: flex !important; align-items: baseline; gap: 2px; min-width: 0; white-space: nowrap; }
      .consignment-readable-card-sku b { flex-shrink: 0; font-size: 10px; }
      .consignment-readable-card-sku span { overflow: hidden; text-overflow: ellipsis; }
      @media (max-width:980px) {
        .consignment-page-toolbar, .consignment-items-toolbar, .consignment-consignors-toolbar { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .consignment-page-toolbar .consignment-search { grid-column:1/-1; }
        .consignment-tool-view { grid-column:1/-1; }
        .consignment-tool-view .consignment-view-toggle { width:100%; }
        .consignment-tool-view .consignment-view-toggle button { flex:1; }
      }
      @media (max-width:600px) {
        .consignment-page-toolbar, .consignment-items-toolbar, .consignment-consignors-toolbar { grid-template-columns:1fr; gap:9px; }
        .consignment-page-toolbar .consignment-search, .consignment-tool-view { grid-column:auto; }
        .consignment-page-toolbar .consignment-filter-select, .consignment-page-toolbar .consignment-select { width:100%; min-width:0; }
        .consignment-readable-grid, .consignment-sales-grid-view { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:8px; }
        .consignment-readable-card { min-width:0; }
        .consignment-readable-card-meta { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
        .consignment-readable-card-meta strong { font-size:18px; overflow-wrap:anywhere; }
        .consignment-readable-card-details { align-items:flex-start; }
        .consignment-readable-card-actions > *,
        .consignment-sales-grid-actions .consignment-sales-pay-btn,
        .consignment-sales-pay-btn.compact { min-height:32px; padding:6px 8px; font-size:10px; }
      }
      .consignment-quick-actions {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px; margin-bottom: 16px;
      }
      .consignment-quick-action {
        display: flex; align-items: center; gap: 11px; min-height: 64px;
        padding: 13px 14px; border: 1px solid var(--line); border-radius: 12px;
        background: var(--surface); color: var(--ink); text-align: left;
      }
      .consignment-quick-action.primary { background: var(--green); color: #fff; border-color: var(--green); }
      .consignment-quick-action-icon {
        width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
        background: var(--green-soft); color: var(--green-dark); flex-shrink: 0;
      }
      .consignment-quick-action.primary .consignment-quick-action-icon { background: rgba(255,255,255,.18); color: #fff; }
      .consignment-quick-action strong { display: block; font-size: 14px; }
      .consignment-quick-action-copy span { display: block; font-size: 11px; opacity: .75; margin-top: 2px; }
      .consignment-optional {
        border: 1px solid var(--line); border-radius: 12px; margin-top: 14px;
        background: #FAFBFB; overflow: hidden;
      }
      .consignment-optional summary {
        cursor: pointer; padding: 13px 14px; font-size: 13px; font-weight: 700;
        color: var(--green-dark); list-style-position: inside;
      }
      .consignment-optional-body { padding: 2px 14px 14px; }
      .consignment-category-results {
        border: 1px solid var(--line); border-radius: 10px; background: var(--surface);
        margin-top: 6px; overflow: hidden;
      }
      .consignment-category-result {
        width: 100%; border: 0; border-bottom: 1px solid var(--line);
        background: transparent; padding: 10px 12px; text-align: left; font-size: 12px;
      }
      .consignment-category-result:last-child { border-bottom: 0; }
      .consignment-selected-category {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        margin-top: 7px; padding: 9px 11px; background: var(--green-soft);
        border-radius: 9px; color: var(--green-dark); font-size: 12px;
      }
      .consignment-header-actions { display: flex; gap: 8px; align-items: center; }
      .consignment-header-actions .consignment-btn { min-width: 0; }
      .consignment-data-menu { position: relative; }
      .consignment-data-menu > summary {
        list-style: none; display: flex; align-items: center; gap: 7px;
        min-height: 40px; padding: 9px 12px; border: 1px solid var(--line);
        border-radius: 9px; background: var(--surface); color: var(--green-dark);
        font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
      }
      .consignment-data-menu > summary::-webkit-details-marker { display: none; }
      .consignment-data-menu-popover {
        position: absolute; top: calc(100% + 6px); right: 0; z-index: 30;
        width: 150px; padding: 5px; border: 1px solid var(--line);
        border-radius: 10px; background: var(--surface);
        box-shadow: 0 10px 28px rgba(0,0,0,.14);
      }
      .consignment-data-menu-popover button {
        width: 100%; display: flex; align-items: center; gap: 8px;
        border: 0; border-radius: 7px; padding: 10px;
        background: transparent; color: var(--ink); font-size: 13px; text-align: left;
      }
      .consignment-data-menu-popover button:hover { background: var(--green-soft); }
      .consignment-import-drop {
        border: 1px dashed #AEB4B8; border-radius: 12px; padding: 24px 18px;
        background: var(--surface); text-align: center; margin-bottom: 14px;
      }
      .consignment-import-drop input { display: none; }
      .consignment-import-drop label { cursor: pointer; display: grid; justify-items: center; gap: 8px; color: var(--green-dark); font-weight: 700; }
      .consignment-import-help { color: var(--muted); font-size: 12px; line-height: 1.5; margin-top: 7px; }
      .consignment-import-preview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
      .consignment-import-preview div { background: #F9FAFB; border-radius: 9px; padding: 12px; }
      .consignment-import-preview span { display: block; color: var(--muted); font-size: 11px; }
      .consignment-import-preview strong { display: block; margin-top: 3px; font-size: 16px; }
      .consignment-import-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .consignment-import-actions .consignment-btn { min-width: 0; box-shadow: none; }
      .consignment-status-filter { margin-bottom: 14px; max-width: 240px; }
      .consignment-status-filter .consignment-label { margin-bottom: 6px; }
      .consignment-list-row {
        display: grid; grid-template-columns: minmax(220px, 2fr) minmax(130px, 1fr) 100px 100px 118px 92px;
        gap: 12px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--line);
        font-size: 13px;
      }
      .consignment-list-row:last-child { border-bottom: 0; }
      .consignment-list-head { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; }
      .consignment-item-groups { display: grid; gap: 12px; }
      .consignment-item-group {
        border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden;
      }
      .consignment-item-group-summary {
        list-style: none; display: grid; grid-template-columns: 30px 38px minmax(0, 1fr) 86px 70px;
        gap: 12px; align-items: center; padding: 14px; cursor: pointer;
      }
      .consignment-item-group-summary::-webkit-details-marker { display: none; }
      .consignment-item-group-chevron {
        width: 28px; height: 28px; border: 1px solid var(--line); border-radius: 999px;
        display: grid; place-items: center; color: var(--muted); transition: transform .15s;
      }
      .consignment-item-group[open] .consignment-item-group-chevron { transform: rotate(90deg); }
      .consignment-item-group-avatar { width: 38px; height: 38px; flex: 0 0 auto; }
      .consignment-item-group-person { min-width: 0; }
      .consignment-item-group-person > span { display: block; }
      .consignment-item-group-link {
        color: var(--green-dark); font-size: 14px; font-weight: 700; width: fit-content; cursor: pointer;
      }
      .consignment-item-group-link:hover, .consignment-item-group-link:focus-visible { text-decoration: underline; }
      .consignment-item-group-meta { display: flex !important; align-items: baseline; gap: 5px; margin-top: 3px; }
      .consignment-item-group-number { color: var(--green-dark); font-size: 15px; font-weight: 800; line-height: 1.2; }
      .consignment-item-group-count { color: var(--muted); font-size: 12px; font-weight: 500; }
      .consignment-item-group-stat { text-align: right; }
      .consignment-item-group-stat strong, .consignment-item-group-stat span { display: block; }
      .consignment-item-group-stat strong { font-size: 14px; }
      .consignment-item-group-stat span { color: var(--muted); font-size: 10px; margin-top: 2px; }
      .consignment-item-group-items { border-top: 1px solid var(--line); }
      .consignment-grouped-item-row {
        display: grid; grid-template-columns: minmax(220px, 2fr) 90px 90px 112px 92px 112px;
        gap: 12px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--line); font-size: 13px;
      }
      .consignment-grouped-item-row:last-child { border-bottom: 0; }
      .consignment-grouped-item-open {
        display: flex; align-items: center; gap: 10px; min-width: 0; border: 0; background: transparent;
        color: inherit; padding: 0; text-align: left; font: inherit;
      }
      .consignment-grouped-item-open > span:last-child { min-width: 0; }
      .consignment-grouped-item-open strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .consignment-grouped-item-open > span:last-child > span { display: block; color: var(--muted); font-size: 11px; margin-top: 2px; }
      .consignment-item-quick-action { display: flex; justify-content: flex-start; }
      .consignment-quick-sold-btn {
        border: 0; border-radius: 8px; padding: 9px 11px; background: var(--green); color: #fff;
        font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer;
      }
      .consignment-quick-sold-btn:disabled { opacity: .65; cursor: wait; }
      .consignment-item-action-note { color: var(--muted); font-size: 11px; }
      .consignment-items-toolbar {
        display: grid; grid-template-columns: minmax(250px, 1fr) 170px 155px 170px auto;
        gap: 10px; align-items: center; margin-bottom: 12px;
      }
      .consignment-view-toggle { display: flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: var(--surface); }
      .consignment-view-toggle button { border: 0; border-right: 1px solid var(--line); background: transparent; color: var(--muted); padding: 10px 11px; font-size: 12px; font-weight: 700; white-space: nowrap; }
      .consignment-view-toggle button:last-child { border-right: 0; }
      .consignment-view-toggle button.active { background: #E7F0FA; color: var(--green-dark); }
      .consignment-finder-toggle button { display:flex; align-items:center; justify-content:center; gap:7px; min-height:42px; cursor:pointer; }
      .consignment-consignor-profile-link { border: 0; background: transparent; color: var(--green-dark); padding: 0; font: inherit; font-weight: 700; text-align: left; cursor: pointer; width: fit-content; }
      .consignment-consignor-profile-link:hover, .consignment-consignor-profile-link:focus-visible { text-decoration: underline; }
      .consignment-item-group-chevron { padding: 0; background: var(--surface); cursor: pointer; }
      .consignment-item-group-chevron.open { transform: rotate(90deg); }
      .consignment-item-open-btn, .consignment-grid-open-btn { border: 1px solid #9EBFE4; border-radius: 8px; background: #fff; color: var(--green-dark); padding: 8px 10px; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; }
      .consignment-all-items-card { padding: 0; overflow: hidden; }
      .consignment-all-item-row { display: grid; grid-template-columns: minmax(210px, 2fr) 82px minmax(120px, 1fr) 84px 88px 108px 90px 108px; gap: 12px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--line); font-size: 13px; }
      .consignment-all-item-row:last-child { border-bottom: 0; }
      .consignment-all-items-card > .consignment-list-head { grid-template-columns: minmax(210px, 2fr) 82px minmax(120px, 1fr) 84px 88px 108px 90px 108px; }
      .consignment-items-grid { display: grid; grid-template-columns: repeat(auto-fill, 148px); gap: 8px; justify-content: start; align-items: start; }
      .consignment-item-grid-card { width: 148px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); overflow: hidden; min-width: 0; }
      .consignment-grid-image { width: 100%; height: 78px; border: 0; border-bottom: 1px solid var(--line); background: #F4F6F8; display: block; padding: 0; overflow: hidden; cursor: pointer; }
      .consignment-grid-image-wrapper { width: 100%; height: 100%; display: grid; place-items: center; overflow: hidden; }
      .consignment-grid-image img { display: block; width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; object-position: center; }
      .consignment-grid-card-body { padding: 8px; display: grid; gap: 5px; overflow: hidden; }
      .consignment-grid-title { border: 0; background: transparent; padding: 0; color: var(--ink); font-size: 11px; font-weight: 800; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
      .consignment-grid-sub { color: var(--muted); font-size: 8px; }
      .consignment-grid-card-body .consignment-consignor-profile-link { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; font-weight: 700; }
      .consignment-grid-meta { display: grid; grid-template-columns: 1fr; gap: 7px; }
      .consignment-grid-meta span { min-width: 0; }
      .consignment-grid-meta small, .consignment-grid-meta strong { display: block; }
      .consignment-grid-meta small { color: var(--muted); font-size: 7px; }
      .consignment-grid-meta strong { font-size: 10px; margin-top: 1px; }
      .consignment-grid-badges { display: flex; flex-wrap: wrap; gap: 3px; min-height: 17px; }
      .consignment-grid-badges .consignment-product-badge, .consignment-grid-badges .consignment-badge { min-width: 0; padding: 3px 5px; font-size: 6px; }
      .consignment-item-grid-card .consignment-quick-sold-btn, .consignment-item-grid-card .consignment-grid-open-btn { width: 100%; padding: 6px; font-size: 9px; }
      .consignment-sales-row {
        display: grid; grid-template-columns: minmax(230px, 2fr) 86px minmax(130px, 1fr) 92px 112px 92px 128px;
        gap: 12px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--line);
        font-size: 13px;
      }
      .consignment-sales-row:last-child { border-bottom: 0; }
      .consignment-sales-action { display: flex; justify-content: flex-start; }
      .consignment-sales-pay-btn {
        border: 0; border-radius: 8px; padding: 9px 12px; background: var(--green); color: white;
        font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer;
      }
      .consignment-sales-paid-note { color: var(--muted); font-size: 12px; font-weight: 600; }
      .consignment-product-badge {
        display: inline-flex; align-items: center; justify-content: center; justify-self: start;
        width: fit-content; min-width: 76px; padding: 5px 9px; border-radius: 999px;
        font-size: 10px; font-weight: 700; line-height: 1; text-transform: uppercase; white-space: nowrap;
      }
      .consignment-product-badge.manual { background: #FDE68A; color: #713F12; }
      .consignment-product-badge.draft { background: #FFF4D6; color: #8A5D14; }
      .consignment-product-badge.pos { background: #E4EEF9; color: #143F73; }
      .consignment-product-badge.online { background: #DFF5E7; color: #17663A; }
      .consignment-item-primary { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .consignment-item-primary strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .consignment-item-primary span { color: var(--muted); font-size: 11px; }
      .consignment-empty-small { text-align: center; color: var(--muted); padding: 28px 16px; font-size: 13px; }
      .consignment-date-tabs { display: flex; gap: 4px; }
      .consignment-date-tabs button {
        border: 0; background: transparent; color: var(--muted); border-radius: 7px;
        padding: 7px 10px; font-size: 12px; font-weight: 600;
      }
      .consignment-date-tabs button.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
      .consignment-payout-summary {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px;
      }
      .consignment-payouts-page { padding-top: 12px; }
      .consignment-payouts-page .consignment-status-row { margin-bottom: 8px; }
      .consignment-payouts-page .consignment-payout-summary { gap: 8px; margin-bottom: 10px; }
      .consignment-payouts-page .consignment-summary-box {
        min-width: 0; min-height: 62px; padding: 10px 12px;
        display: flex; flex-direction: column; justify-content: center;
      }
      .consignment-payouts-page .consignment-summary-box span { line-height: 1.2; }
      .consignment-payouts-page .consignment-summary-box strong { margin-top: 3px; line-height: 1.1; }
      .consignment-payouts-page .consignment-items-toolbar { gap: 8px; margin-bottom: 10px; }
      .consignment-payouts-page .consignment-items-filter-summary { min-height: 44px; padding: 10px 12px; }
      .consignment-payouts-page .consignment-items-filter-details .consignment-items-toolbar-top { padding: 10px 12px 12px; }
      .consignment-payouts-page .consignment-items-toolbar-bottom { gap: 8px; }
      .consignment-payouts-page .consignment-search { margin-bottom: 0; }
      .consignment-payouts-page .consignment-payout-list { margin-bottom: 10px; }
      .consignment-payouts-page .consignment-payout-list .consignment-section-title { margin-bottom: 10px; }
      .consignment-payout-row {
        display: grid; grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px 16px; align-items: center;
        border: 1px solid var(--line); border-radius: 12px;
        padding: 14px; margin-bottom: 10px; background: var(--surface);
      }
      .consignment-payout-group { display: block; padding: 0; }
      .consignment-payout-group-summary {
        display: grid; grid-template-columns: 18px minmax(0, 1fr) auto auto auto;
        align-items: center; gap: 12px 16px; padding: 14px;
        cursor: pointer; list-style: none;
      }
      .consignment-payout-group-stat { text-align: center; min-width: 56px; }
      .consignment-payout-group-stat strong, .consignment-payout-group-stat span { display: block; }
      .consignment-payout-group-stat strong { font-size: 16px; }
      .consignment-payout-group-stat span { color: var(--muted); font-size: 11px; margin-top: 2px; }
      .consignment-payout-group-summary::-webkit-details-marker { display: none; }
      .consignment-payout-chev { color: var(--muted); flex-shrink: 0; transition: transform .15s; }
      .consignment-payout-group[open] .consignment-payout-chev { transform: rotate(90deg); }
      .consignment-payout-group .consignment-payout-person { cursor: pointer; }
      .consignment-payout-group .consignment-payout-all-items {
        padding: 0 14px 14px 44px; border-top: 1px solid var(--line);
      }
      .consignment-payout-group .consignment-payout-all-items { padding-top: 12px; }
      .consignment-consignor-card-open:disabled { opacity: .5; cursor: default; }
      .consignment-consignor-card-open:disabled:hover { background: var(--surface); border-color: var(--line); color: var(--ink); }
      .consignment-payout-person {
        display: flex; align-items: center; gap: 12px; min-width: 0;
        border: 0; background: transparent; text-align: left; padding: 0;
      }
      .consignment-payout-action {
        display: flex; align-items: center; gap: 12px; justify-content: flex-end;
      }
      .consignment-payout-amount { font-size: 17px; white-space: nowrap; }
      .consignment-payout-action .consignment-btn {
        width: auto; min-width: 132px; padding: 10px 14px; box-shadow: none;
      }
      .consignment-summary-box { background: #F9FAFB; border-radius: 9px; padding: 12px; }
      .consignment-summary-box span { display: block; color: var(--muted); font-size: 11px; }
      .consignment-summary-box strong { display: block; margin-top: 4px; font-size: 18px; }
      .consignment-payout-fields {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
      }
      .consignment-payout-fields > .consignment-field { min-width: 0; }
      .consignment-store-credit-note {
        display: flex; gap: 9px; align-items: flex-start; padding: 11px 12px;
        margin: -2px 0 14px; border-radius: 10px; background: var(--gold-soft);
        color: #714B0E; font-size: 12px; line-height: 1.45;
      }
      .consignment-history-list { display: grid; gap: 10px; }
      .consignment-history-card {
        width: 100%; border: 1px solid var(--line); border-radius: 13px;
        background: var(--surface); color: var(--ink); overflow: hidden; text-align: left;
      }
      .consignment-history-card-summary {
        width: 100%; min-width: 0; margin: 0; border: 0;
        display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto;
        align-items: center; gap: 11px; padding: 14px;
        background: transparent; color: inherit; text-align: left;
        appearance: none; -webkit-appearance: none;
      }
      .consignment-history-card-summary:hover { background: #FAFBFB; }
      .consignment-history-card-summary:active { background: var(--green-soft); }
      .consignment-history-card-copy { min-width: 0; }
      .consignment-history-card-copy strong {
        display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .consignment-history-consignor-link {
        display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-weight: 700; color: var(--ink); cursor: pointer;
      }
      .consignment-history-consignor-link:hover { color: var(--green); text-decoration: underline; }
      .consignment-history-consignor-link:focus-visible {
        color: var(--green); text-decoration: underline; outline: 2px solid var(--green-soft); outline-offset: 2px;
      }
      .consignment-history-card-copy span { display: block; color: var(--muted); font-size: 11px; margin-top: 3px; }
      .consignment-history-card-amount { text-align: right; }
      .consignment-history-card-amount strong { display: block; font-size: 16px; }
      .consignment-history-card-amount span { display: block; color: var(--muted); font-size: 11px; margin-top: 3px; }
      .consignment-history-card-details {
        border-top: 1px solid var(--line); padding: 13px 14px; background: #FAFBFB;
      }
      .consignment-history-meta {
        display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;
        margin-bottom: 12px;
      }
      .consignment-history-meta div { background: var(--surface); border-radius: 9px; padding: 9px; }
      .consignment-history-meta span { display: block; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
      .consignment-history-meta strong { display: block; font-size: 12px; margin-top: 3px; overflow-wrap: anywhere; }
      .consignment-history-item {
        display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px;
        align-items: center; padding: 10px 0; border-top: 1px solid var(--line);
      }
      .consignment-history-item:first-of-type { border-top: 0; }
      .consignment-history-item-copy strong { display: block; font-size: 13px; }
      .consignment-history-item-copy span { display: block; color: var(--muted); font-size: 11px; margin-top: 2px; }
      .consignment-history-note { color: var(--muted); font-size: 11px; margin-top: 10px; line-height: 1.45; }
      .consignment-paid-detail { display: block; color: var(--green-dark); font-size: 11px; margin-top: 4px; }

      .consignment-tag {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--ink); color: #fff; font-family: 'Fraunces', serif;
        font-weight: 600; font-size: 12px; padding: 3px 10px 3px 8px; border-radius: 4px 10px 10px 4px;
        position: relative;
      }
      .consignment-tag::before {
        content: ''; width: 5px; height: 5px; border-radius: 999px; background: #fff;
      }

      .consignment-photo-btn {
        width: 84px; height: 84px; border-radius: 14px; border: 1.5px dashed var(--line);
        background: var(--surface); display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 4px; color: var(--muted); font-size: 11px; flex-shrink: 0;
        overflow: hidden; text-align: center; line-height: 1.2;
      }
      .consignment-photo-btn img { width: 100%; height: 100%; object-fit: cover; }
      .consignment-photo-wrap { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; }
      .consignment-photo-alt {
        font-size: 10.5px; color: var(--muted); text-decoration: underline;
        text-align: center; max-width: 84px;
      }

      .consignment-intake-primary {
        display: grid; grid-template-columns: 128px minmax(0, 1fr);
        gap: 16px; align-items: start; padding: 16px;
        margin-bottom: 0; border-radius: 12px 12px 0 0;
      }
      .consignment-intake-primary .consignment-photo-wrap {
        width: 128px; gap: 6px;
      }
      .consignment-intake-primary .consignment-photo-btn {
        width: 128px; height: 128px; border-radius: 10px;
        background: #FAFBFB; font-size: 11px; gap: 5px;
      }
      .consignment-intake-primary .consignment-photo-btn svg { width: 22px; height: 22px; }
      .consignment-intake-primary .consignment-photo-alt {
        max-width: 128px; font-size: 10px;
      }
      .consignment-intake-primary-fields {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 240px);
        gap: 12px; align-content: start; padding-top: 1px;
      }
      .consignment-intake-primary + .consignment-detail-card {
        margin-top: 0; border-top: 0; border-radius: 0 0 12px 12px;
      }
      .consignment-intake-primary-fields .consignment-field { margin: 0; min-width: 0; }
      .consignment-intake-primary-fields .consignment-input {
        min-height: 46px; border-radius: 10px;
      }
      .consignment-shopify-photo-row {
        display: grid; grid-template-columns: 140px minmax(0, 1fr);
        gap: 16px; align-items: start; margin-top: 12px;
      }

      .consignment-batch-item {
        display: flex; align-items: center; gap: 10px; background: var(--surface);
        border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px;
      }
      .consignment-batch-thumb {
        width: 44px; height: 44px; border-radius: 8px; background: var(--green-soft);
        flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;
      }
      .consignment-batch-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .consignment-batch-remove {
        width: 30px; height: 30px; border-radius: 999px; border: none; background: var(--danger-soft);
        color: var(--danger); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }

      .consignment-toast {
        position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
        background: var(--ink); color: #fff; padding: 10px 18px; border-radius: 999px;
        font-size: 13px; font-weight: 500; z-index: 50; display: flex; align-items: center; gap: 6px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
      }

      .consignment-loading { display: flex; align-items: center; justify-content: center; height: 100%; padding: 80px 0; color: var(--muted); }
      .consignment-spin { animation: consignment-spin 1s linear infinite; }
      @keyframes consignment-spin { to { transform: rotate(360deg); } }

      .consignment-footnote {
        text-align: center; font-size: 12px; color: var(--muted); padding: 18px 0 6px;
      }
      .consignment-footnote button { background: none; border: none; color: var(--muted); text-decoration: underline; font-size: 12px; }

      @media (prefers-reduced-motion: reduce) {
        .consignment-row-btn, .consignment-btn, .consignment-back { transition: none; }
        .consignment-spin { animation: none; }
      }
      .consignment button:focus-visible, .consignment input:focus-visible, .consignment select:focus-visible {
        outline: 2px solid var(--green); outline-offset: 2px;
      }
      @media (max-width: 900px) {
        .consignment-dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .consignment-section-grid { grid-template-columns: 1fr; }
        .consignment-list-row { grid-template-columns: minmax(180px, 2fr) minmax(110px, 1fr) 85px 108px 92px; }
        .consignment-list-row > :nth-child(4) { display: none; }
        .consignment-grouped-item-row { grid-template-columns: minmax(190px, 2fr) 84px 106px 88px 106px; }
        .consignment-grouped-item-row > :nth-child(3) { display: none; }
        .consignment-sales-row { grid-template-columns: minmax(200px, 2fr) 80px minmax(120px, 1fr) 88px 100px 86px 118px; }
        .consignment-items-toolbar { grid-template-columns: minmax(220px, 1fr) 160px 145px 160px; }
        .consignment-view-toggle { grid-column: 1 / -1; width: fit-content; }
        .consignment-items-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .consignment-all-item-row, .consignment-all-items-card > .consignment-list-head { grid-template-columns: minmax(180px, 2fr) 76px minmax(105px, 1fr) 80px 102px 86px 102px; }
        .consignment-all-item-row > :nth-child(5), .consignment-all-items-card > .consignment-list-head > :nth-child(5) { display: none; }
      }
      @media (max-width: 640px) {
        .consignment { padding-bottom: 74px; }
        .consignment-back-to-top {
          right: 14px;
          bottom: calc(84px + env(safe-area-inset-bottom));
        }
        .consignment-header { padding: 18px 16px 12px; position: static; }
        .consignment-header-row { flex-direction: column; align-items: stretch; gap: 10px; }
        .consignment-header-action { width: 100%; }
        .consignment-header-actions { flex-wrap: wrap; }
        .consignment-header-actions .consignment-btn {
          width: calc(50% - 4px); flex: 0 0 auto;
        }
        .consignment-body { padding: 14px 16px 96px; }
        .consignment-fab-wrap { padding-left: 16px; padding-right: 16px; bottom: 68px; }
        .consignment-btn { width: 100%; min-width: 0; }
        .consignment-main-nav {
          position: fixed; top: auto; bottom: 0; left: 0; right: 0;
          justify-content: space-around; padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
          border-top: 1px solid var(--line); border-bottom: 0; box-shadow: 0 -5px 18px rgba(0,0,0,.08);
        }
        .consignment-brand { display: none; }
        .consignment-nav-button { flex: 1; flex-direction: column; gap: 3px; font-size: 10px; padding: 6px 2px; }
        .consignment-dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .consignment-metric { padding: 13px; min-height: 108px; }
        .consignment-metric-value { font-size: 21px; }
        .consignment-section-grid { grid-template-columns: 1fr; }
        .consignment-list-head { display: none; }
        .consignment-list-row {
          grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 12px;
        }
        .consignment-list-row > :nth-child(2), .consignment-list-row > :nth-child(3), .consignment-list-row > :nth-child(4), .consignment-list-row > :nth-child(6) { display: none; }
        .consignment-item-group-summary { grid-template-columns: 28px 36px minmax(0, 1fr); gap: 9px; padding: 12px; }
        .consignment-item-group-stat { display: none; }
        .consignment-grouped-item-row {
          position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px 12px;
        }
        .consignment-grouped-item-row.consignment-list-head { display: none; }
        .consignment-grouped-item-row > :nth-child(1) { flex: 1 1 100%; min-width: 0; padding-right: 96px; }
        .consignment-grouped-item-row > :nth-child(3) { display: none; }
        .consignment-grouped-item-row > .consignment-item-quick-action {
          position: absolute; top: 12px; right: 12px; margin: 0;
          display: flex; justify-content: flex-end;
        }
        .consignment-grouped-item-row .consignment-item-open-btn,
        .consignment-grouped-item-row .consignment-quick-sold-btn { width: auto; min-width: 0; padding: 7px 9px; font-size: 11px; }
        .consignment-sales-row { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 12px; }
        .consignment-sales-row.consignment-list-head { display: none; }
        .consignment-sales-row > :nth-child(2), .consignment-sales-row > :nth-child(3), .consignment-sales-row > :nth-child(4), .consignment-sales-row > :nth-child(5), .consignment-sales-row > :nth-child(6) { display: none; }
        .consignment-sales-pay-btn { width: auto; min-width: 112px; }
        .consignment-items-toolbar { grid-template-columns: 1fr; }
        .consignment-view-toggle { width: 100%; }
        .consignment-view-toggle button { flex: 1; padding: 9px 5px; font-size: 10px; }
        .consignment-items-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; justify-content: stretch; }
        .consignment-item-grid-card { width: 100%; }
        .consignment-grid-image { height: 78px; }
        .consignment-grid-card-body { padding: 8px; }
        .consignment-all-item-row {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px;
        }
        .consignment-all-items-card > .consignment-list-head { display: none; }
        .consignment-all-item-row > :nth-child(1) { flex: 1 1 100%; }
        .consignment-all-item-row > :nth-child(3), .consignment-all-item-row > :nth-child(5) { display: none; }
        .consignment-all-item-row > :nth-child(2) { font-weight: 800; color: var(--green-dark); }
        .consignment-all-item-row > :nth-child(8) { margin-left: auto; }
        .consignment-payout-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .consignment-payouts-page { padding-top: 10px; }
        .consignment-payouts-page .consignment-payout-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-bottom: 8px;
        }
        .consignment-payouts-page .consignment-summary-box { min-height: 58px; padding: 9px 10px; }
        .consignment-payouts-page .consignment-summary-box strong { font-size: 17px; }
        .consignment-payouts-page .consignment-items-toolbar { gap: 8px; margin-bottom: 8px; }
        .consignment-payouts-page .consignment-items-toolbar-bottom { gap: 8px; }
        .consignment-payouts-page .consignment-payout-list { padding: 12px; }
        .consignment-quick-actions { grid-template-columns: 1fr 1fr; gap: 8px; }
        .consignment-quick-action { min-height: 72px; padding: 11px; align-items: flex-start; }
        .consignment-filter-select { width: 100%; }
        .consignment-row2, .consignment-payout-fields { display: grid; grid-template-columns: minmax(0, 1fr); }
        .consignment-intake-primary {
          grid-template-columns: 96px minmax(0, 1fr); gap: 12px; padding: 12px;
        }
        .consignment-intake-primary .consignment-photo-wrap { width: 96px; }
        .consignment-intake-primary .consignment-photo-btn {
          width: 96px; height: 96px; aspect-ratio: auto;
        }
        .consignment-intake-primary .consignment-photo-alt { max-width: 96px; }
        .consignment-intake-primary-fields {
          grid-template-columns: minmax(0, 1fr); gap: 9px;
        }
        .consignment-shopify-photo-row {
          grid-template-columns: minmax(0, 1fr); gap: 12px;
        }
        .consignment-shopify-photo-row .consignment-photo-btn { width: 96px; height: 96px; }
        .consignment-detail-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .consignment-detail-grid .consignment-field.wide { grid-column: auto; }
        .consignment-manual-sale-controls { grid-template-columns: minmax(0, 1fr) 76px; gap: 8px; }
        .consignment-manual-sale .consignment-sold-btn { width: auto; min-width: 76px; }
        .consignment-sold-status { align-items: flex-start; flex-direction: column; gap: 6px; }
        .consignment-sold-status .consignment-row-sub { text-align: left; }
        .consignment-payout-row { grid-template-columns: 1fr; gap: 12px; }
        .consignment-payout-group-summary { grid-template-columns: 18px minmax(0, 1fr); }
        .consignment-payout-group-summary .consignment-payout-group-stat { display: none; }
        .consignment-payout-group-summary .consignment-payout-action { grid-column: 1 / -1; justify-content: space-between; }
        .consignment-payout-action { justify-content: space-between; }
        .consignment-payout-action .consignment-btn { width: auto; min-width: 132px; }
        .consignment-payout-create-body { padding-bottom: 180px; }
        .consignment-history-card-summary {
          grid-template-columns: auto minmax(0, 1fr) auto;
          grid-template-areas:
            "avatar copy arrow"
            "avatar amount arrow"
            "avatar paid arrow";
          padding: 13px 12px; gap: 5px 10px;
        }
        .consignment-history-card-summary > .consignment-avatar { grid-area: avatar; }
        .consignment-history-card-copy { grid-area: copy; }
        .consignment-history-card-amount {
          grid-area: amount; text-align: left;
          display: flex; align-items: baseline; gap: 8px;
        }
        .consignment-history-card-amount strong { font-size: 17px; }
        .consignment-history-card-amount span { margin-top: 0; }
        .consignment-history-card-summary > .consignment-badge { grid-area: paid; justify-self: start; }
        .consignment-history-card-summary > svg { grid-area: arrow; }
        .consignment-history-meta { grid-template-columns: 1fr; }
      }

      /* Shared readable card layout — used by both the Items grid and the
         Sales grid so the two views look consistent. */
      .consignment-readable-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; align-items:stretch; }
      .consignment-readable-card { min-width:0; min-height:270px; display:flex; flex-direction:column; padding:16px; border:1px solid var(--line); border-radius:12px; background:#fff; box-shadow:0 1px 2px rgba(16,24,40,.04); }
      .consignment-readable-card-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      .consignment-readable-card-top strong { display:block; overflow:hidden; color:var(--ink); font-size:16px; line-height:1.25; white-space:nowrap; text-overflow:ellipsis; }
      .consignment-readable-card-top small { display:block; margin-top:5px; color:var(--muted); font-size:11px; }
      .consignment-readable-card-top small b { color:var(--ink); }
      .consignment-grid-thumb-row { display:flex; gap:10px; align-items:center; min-width:0; }
      .consignment-grid-thumb { flex:0 0 auto; width:44px; height:44px; border-radius:8px; overflow:hidden; background:var(--green-soft); display:flex; align-items:center; justify-content:center; }
      .consignment-grid-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      .consignment-readable-consignor-link { padding:0; border:0; background:none; color:var(--green); font:inherit; font-size:14px; font-weight:800; text-align:left; cursor:pointer; margin-top:12px; }
      .consignment-readable-card-meta { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:16px 0 14px; padding:14px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
      .consignment-readable-card-meta span { display:flex; flex-direction:column; gap:3px; }
      .consignment-readable-card-meta small { color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; }
      .consignment-readable-card-meta strong { color:var(--ink); font-size:21px; line-height:1.1; }
      .consignment-sales-money-rows { grid-template-columns:1fr; gap:0; }
      .consignment-sales-money-rows > span { flex-direction:row; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; }
      .consignment-sales-money-rows > span + span { border-top:1px solid var(--line); }
      .consignment-sales-money-rows strong { white-space:nowrap; overflow-wrap:normal; word-break:normal; flex-shrink:0; }
      .consignment-readable-card-details { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
      .consignment-readable-card-details strong { color:var(--ink); font-size:13px; }
      .consignment-readable-card-actions { margin-top:auto; display:flex; gap:8px; flex-wrap:wrap; }
      .consignment-readable-card-actions > * { flex:1; min-height:42px; }
      @media (max-width:1100px) { .consignment-readable-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .consignment-readable-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .consignment-readable-card { min-height:250px; padding:13px; } .consignment-readable-card-meta strong { font-size:18px; } }

      .consignment-consignor-card-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; align-items:stretch; }
      .consignment-consignor-card {
        display:flex; flex-direction:column; gap:12px; background:var(--surface);
        border:1px solid var(--line); border-radius:12px; padding:16px;
      }
      .consignment-consignor-card-top { display:flex; align-items:center; gap:10px; }
      .consignment-consignor-card-name { display:flex; flex-direction:column; min-width:0; }
      .consignment-consignor-card-name strong { font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .consignment-consignor-card-name small { color:var(--muted); font-size:11px; }
      .consignment-consignor-card-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
      .consignment-consignor-card-stats span {
        display:flex; flex-direction:column; align-items:center; gap:2px;
        background:#FAFAFB; border-radius:8px; padding:8px;
      }
      .consignment-consignor-card-stats strong { font-size:16px; }
      .consignment-consignor-card-stats small { color:var(--muted); font-size:10px; text-transform:uppercase; font-weight:700; }
      .consignment-consignor-card-due { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:var(--muted); }
      .consignment-consignor-card-due strong { color:var(--ink); font-size:15px; }
      .consignment-consignor-card-open {
        margin-top:auto; border:1px solid var(--line); background:var(--surface); border-radius:8px;
        padding:9px; font-size:12px; font-weight:700; cursor:pointer; color:var(--ink);
      }
      .consignment-consignor-card-open:hover { background:var(--blue-soft); border-color:var(--blue); color:var(--green-dark); }
      @media (max-width:1100px) { .consignment-consignor-card-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .consignment-consignor-card-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }

      /* Items toolbar: two clean rows matching the approved inventory layout. */
      .consignment-items-toolbar {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        margin: 2px 0 16px;
      }
      .consignment-items-toolbar-top {
        display: grid;
        grid-template-columns: repeat(4, minmax(150px, 1fr));
        gap: 12px;
        max-width: 920px;
        align-items: end;
      }
      .consignment-items-toolbar-bottom {
        display: grid;
        grid-template-columns: minmax(260px, 520px) auto;
        gap: 12px;
        align-items: end;
      }
      .consignment-items-toolbar .consignment-tool-field,
      .consignment-items-toolbar .consignment-tool-view { min-width: 0; }
      .consignment-items-toolbar .consignment-tool-field > span,
      .consignment-items-toolbar .consignment-tool-view > span {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .consignment-items-toolbar .consignment-select {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        border-radius: 11px;
      }
      .consignment-items-toolbar .consignment-search {
        width: 100%;
        min-width: 0;
        min-height: 46px;
        margin: 0;
        border-radius: 12px;
      }
      .consignment-items-toolbar .consignment-view-toggle { min-height: 46px; }
      @media (max-width: 900px) {
        .consignment-items-toolbar-top { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: none; }
      }
      @media (max-width: 640px) {
        .consignment-items-toolbar { gap: 12px; }
        .consignment-items-toolbar-top,
        .consignment-items-toolbar-bottom { grid-template-columns: 1fr; gap: 9px; }
        .consignment-items-toolbar .consignment-view-toggle { width: 100%; }
        .consignment-items-toolbar .consignment-view-toggle button { flex: 1; min-height: 44px; font-size: 12px; }
      }
      /* Consignor dashboard */
      .consignment-consignor-profile {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow: hidden; padding: 0; margin-bottom: 10px;
      }
      .consignment-profile-column { min-width: 0; padding: 10px 14px; }
      .consignment-profile-column + .consignment-profile-column { border-left: 1px solid var(--line); background: #FAFBFC; }
      .consignment-profile-title {
        margin: 0 0 2px; color: var(--ink); font-size: 10px; font-weight: 800;
        text-align: center; text-transform: uppercase; letter-spacing: .07em;
      }
      .consignment-profile-row {
        min-height: 50px; display: grid; grid-template-columns: 25px minmax(0, 1fr);
        align-items: center; gap: 8px; border-bottom: 1px solid #EDF0F2;
      }
      .consignment-profile-row:last-child { border-bottom: 0; }
      .consignment-profile-row.detail { grid-template-columns: minmax(0, 1fr); padding-left: 33px; }
      .consignment-profile-icon { width: 25px; height: 25px; display: grid; place-items: center; color: var(--muted); }
      .consignment-profile-copy { min-width: 0; }
      .consignment-profile-label {
        display: block; margin-bottom: 3px; color: var(--muted); font-size: 9px;
        font-weight: 800; line-height: 1; text-transform: uppercase; letter-spacing: .045em;
      }
      .consignment-profile-value { display: block; color: var(--ink); font-size: 12px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
      .consignment-profile-link { color: var(--blue); font-weight: 750; text-decoration: none; }
      .consignment-profile-link:hover, .consignment-profile-link:focus { text-decoration: underline; }
      .consignment-consignor-stats {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px; margin-bottom: 16px;
      }
      .consignment-consignor-stat {
        min-width: 0; min-height: 62px; display: flex; flex-direction: column;
        justify-content: center; padding: 10px 12px; border: 1px solid var(--line);
        border-radius: 9px; background: var(--surface);
      }
      .consignment-consignor-stat span { color: var(--muted); font-size: 11px; font-weight: 650; white-space: nowrap; }
      .consignment-consignor-stat strong { margin-top: 5px; color: var(--ink); font-size: 20px; line-height: 1; white-space: nowrap; }
      .consignment-consignor-items-head {
        display: flex; align-items: flex-end; justify-content: space-between;
        gap: 12px; margin: 0 0 9px;
      }
      .consignment-consignor-items-head h3 { margin: 0; font-size: 17px; }
      .consignment-consignor-items-tools { display: flex; align-items: center; gap: 10px; }
      .consignment-consignor-items-count { color: var(--muted); font-size: 13px; }
      .consignment-consignor-view-toggle {
        display: grid; grid-template-columns: 1fr 1fr; overflow: hidden;
        border: 1px solid var(--line); border-radius: 8px; background: var(--surface);
      }
      .consignment-consignor-view-toggle button {
        height: 32px; padding: 0 12px; border: 0; border-right: 1px solid var(--line);
        background: var(--surface); color: var(--muted); font-size: 12px; font-weight: 750;
      }
      .consignment-consignor-view-toggle button:last-child { border-right: 0; }
      .consignment-consignor-view-toggle button.active { background: #EAF2FC; color: #153E7A; }
      .consignment-consignor-item-list { display: grid; gap: 8px; }
      .consignment-consignor-item {
        display: grid; grid-template-columns: minmax(0, 1fr) auto;
        align-items: center; gap: 12px; margin: 0; padding: 10px 12px;
      }
      .consignment-consignor-item-open {
        min-width: 0; display: grid; grid-template-columns: 48px minmax(0, 1fr);
        align-items: center; gap: 12px; padding: 0; border: 0; background: transparent; text-align: left;
      }
      .consignment-consignor-item-copy { min-width: 0; }
      .consignment-consignor-item-title { display: block; overflow: hidden; color: var(--ink); font-size: 14px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
      .consignment-consignor-item-meta { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; line-height: 1.35; }
      .consignment-consignor-item-actions {
        display: grid; grid-template-columns: minmax(92px, auto) minmax(104px, auto) minmax(112px, auto);
        align-items: center; justify-content: end; gap: 7px;
      }
      .consignment-consignor-item-actions .consignment-product-badge,
      .consignment-consignor-item-actions .consignment-badge {
        width: 100%; min-width: 0; min-height: 28px; box-sizing: border-box;
        justify-content: center; text-align: center;
      }
      .consignment-consignor-pay-btn {
        height: 34px; padding: 0 11px; border: 0; border-radius: 8px;
        background: var(--blue); color: white; font-size: 11px; font-weight: 750; white-space: nowrap;
      }
      .consignment-consignor-action-spacer { display: block; min-height: 1px; }
      .consignment-consignor-item-list.grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      @media (max-width: 1100px) {
        .consignment-consignor-item-list.grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      .consignment-consignor-item-list.grid .consignment-consignor-item {
        display: flex; flex-direction: column; align-items: stretch; min-width: 0; min-height: 180px;
      }
      .consignment-consignor-item-list.grid .consignment-consignor-item-open {
        grid-template-columns: 42px minmax(0, 1fr);
      }
      .consignment-consignor-item-list.grid .consignment-consignor-item-actions {
        grid-template-columns: 1fr; justify-content: stretch; width: 100%; margin-top: auto;
      }

      @media (max-width: 640px) {
        .consignment-consignor-profile { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .consignment-profile-column { padding: 9px 10px; }
        .consignment-profile-row { min-height: 54px; grid-template-columns: 20px minmax(0, 1fr); gap: 6px; }
        .consignment-profile-row.detail { grid-template-columns: minmax(0, 1fr); padding-left: 26px; }
        .consignment-profile-icon { width: 20px; height: 20px; }
        .consignment-profile-label { font-size: 8px; }
        .consignment-profile-value { font-size: 10px; }
        .consignment-consignor-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-bottom: 14px; }
        .consignment-consignor-stat { min-height: 58px; padding: 9px 7px; }
        .consignment-consignor-stat span { font-size: 9px; }
        .consignment-consignor-stat strong { font-size: 17px; }
        .consignment-consignor-items-head { align-items: flex-start; flex-direction: column; }
        .consignment-consignor-items-tools { width: 100%; justify-content: space-between; }
        .consignment-consignor-view-toggle { margin-left: auto; }
        .consignment-consignor-item-list.grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .consignment-consignor-item-list.grid .consignment-consignor-item {
          min-width: 0; min-height: 218px; padding: 10px; gap: 8px; overflow: hidden;
        }
        .consignment-consignor-item-list.grid .consignment-consignor-item-open {
          grid-template-columns: 36px minmax(0, 1fr); gap: 8px; align-items: start;
        }
        .consignment-consignor-item-list.grid .consignment-batch-thumb {
          width: 36px !important; height: 36px !important; border-radius: 8px !important;
        }
        .consignment-consignor-item-list.grid .consignment-consignor-item-title {
          font-size: 12px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .consignment-consignor-item-list.grid .consignment-consignor-item-meta {
          font-size: 10px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis;
        }
        .consignment-consignor-item-list.grid .consignment-consignor-item-actions {
          grid-template-columns: 1fr; gap: 6px; width: 100%; margin-top: auto;
        }
        .consignment-consignor-item-list.grid .consignment-consignor-item-actions .consignment-product-badge,
        .consignment-consignor-item-list.grid .consignment-consignor-item-actions .consignment-badge,
        .consignment-consignor-item-list.grid .consignment-consignor-pay-btn {
          width: 100%; min-width: 0;
        }

        .consignment-consignor-item-list:not(.grid) .consignment-consignor-item {
          display: grid; grid-template-columns: minmax(0, 1fr); align-items: stretch;
          gap: 10px; padding: 12px; overflow: hidden;
        }
        .consignment-consignor-item-list:not(.grid) .consignment-consignor-item-open {
          grid-template-columns: 44px minmax(0, 1fr); gap: 10px; width: 100%;
        }
        .consignment-consignor-item-list:not(.grid) .consignment-batch-thumb {
          width: 44px !important; height: 44px !important; border-radius: 9px !important;
        }
        .consignment-consignor-item-list:not(.grid) .consignment-consignor-item-actions {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          justify-content: stretch; padding-left: 0; width: 100%; gap: 7px;
        }
        .consignment-consignor-item-list:not(.grid) .consignment-consignor-item-actions .consignment-product-badge,
        .consignment-consignor-item-list:not(.grid) .consignment-consignor-item-actions .consignment-badge {
          width: 100%; min-width: 0; min-height: 30px;
        }
        .consignment-consignor-item-list:not(.grid) .consignment-consignor-pay-btn {
          grid-column: 1 / -1; width: 100%; height: 36px;
        }
        .consignment-consignor-item-list:not(.grid) .consignment-consignor-action-spacer {
          display: none;
        }
        .consignment-consignor-item-title { font-size: 13px; }
        .consignment-consignor-item-meta { font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
        .consignment-consignor-pay-btn { padding: 0 8px; font-size: 10px; }
      }
    `}</style>
  );
}

/* ---------- small components ---------- */

function Header({ eyebrow, title, onBack = null, action = null }) {
  return (
    <div className="consignment-header">
      <div className="consignment-header-row">
        <div className="consignment-header-main">
          {onBack && (
            <button className="consignment-back" onClick={onBack} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            {eyebrow && <p className="consignment-eyebrow">{eyebrow}</p>}
            <h1 className="consignment-title">{title}</h1>
          </div>
        </div>
        {action && <div className="consignment-header-action">{action}</div>}
      </div>
    </div>
  );
}

async function handlePhotoFile(e, onChange) {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await resizeImage(file);
  onChange(dataUrl);
}

function PhotoPicker({ value, onChange }) {
  return (
    <div className="consignment-photo-wrap">
      <label className="consignment-photo-btn">
        {value ? (
          <img src={value} alt="Item" />
        ) : (
          <>
            <Camera size={20} />
            <span>Take Photo</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handlePhotoFile(e, onChange)}
        />
      </label>
      <label className="consignment-photo-alt">
        {value ? 'Retake or choose' : 'Choose from library'}
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handlePhotoFile(e, onChange)}
        />
      </label>
    </div>
  );
}

function statusClass(status) {
  return String(status || 'Draft').toLowerCase();
}

// Display-only relabel: the stored status value stays "Draft" (so existing
// data and filters keep working) but manual items show "Available" instead.
function statusLabel(status) {
  const value = status || 'Draft';
  return value === 'Draft' ? 'Available' : value;
}

function AppNavigation({ view, onNavigate }) {
  const entries = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['home', 'Consignors', Users],
    ['items', 'Items', PackageSearch],
    ['sales', 'Sales', ReceiptText],
    ['payouts', 'Payouts', WalletCards],
    ['reports', 'Reports', TrendingUp],
  ];

  return (
    <nav className="consignment-main-nav" aria-label="Consignment manager">
      <div className="consignment-brand">
        <span className="consignment-brand-mark"><Tag size={18} /></span>
        JustConsignIn
      </div>
      {entries.map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          className={`consignment-nav-button ${view === key ? 'active' : ''}`}
          onClick={() => onNavigate(key)}
        >
          <Icon size={17} />
          {label}
        </button>
      ))}
    </nav>
  );
}

function MetricCard({ icon: Icon, label, value, note, onClick }) {
  return (
    <button type="button" className="consignment-metric" onClick={onClick} aria-label={`Open ${label}`}>
      <div className="consignment-metric-icon"><Icon size={18} /></div>
      <div className="consignment-metric-label">{label}</div>
      <div className="consignment-metric-value">{value}</div>
      {note && <div className="consignment-metric-note">{note}</div>}
    </button>
  );
}

function DashboardScreen({
  consignors,
  items,
  onOpenConsignor,
  onNavigate,
  onNewConsignor,
  onNewItem,
  onImport,
  onExport,
}) {
  const soldItems = items.filter((item) => item.status === 'Sold' || item.dateSold);
  const activeItems = items.filter((item) => ['Available', 'Active'].includes(item.status));
  const totalSales = soldItems.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const unpaidSales = soldItems.filter((item) => !item.paidOut);
  const amountDue = unpaidSales.reduce(
    (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? 0)) / 100,
    0,
  );

  // Consignment term / expiry tracking — expiryDate comes straight from the
  // consignment_item metaobject's expiry_date field (already computed and
  // stored on create/update in api.consignment.jsx). Only active,
  // not-yet-paid-out items are counted — a sold or paid-out item's term is
  // no longer relevant.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const itemsWithExpiry = items.filter(
    (item) => item.expiryDate && !item.paidOut && (item.status === 'Available' || item.status === 'Active'),
  );
  const expiredItems = itemsWithExpiry.filter((item) => new Date(`${item.expiryDate}T00:00:00`) < today);
  const expiring7Items = itemsWithExpiry.filter((item) => {
    const d = new Date(`${item.expiryDate}T00:00:00`);
    return d >= today && d <= in7;
  });
  const expiring30Items = itemsWithExpiry.filter((item) => {
    const d = new Date(`${item.expiryDate}T00:00:00`);
    return d >= today && d <= in30;
  });

  const consignorBalances = consignors
    .map((consignor) => {
      const sales = unpaidSales.filter((item) => item.consignorId === consignor.id);
      const due = sales.reduce(
        (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
        0,
      );
      return { consignor, sales, due };
    })
    .filter((entry) => entry.due > 0)
    .sort((a, b) => b.due - a.due);

  const recentSales = [...soldItems]
    .sort((a, b) => String(b.dateSold || '').localeCompare(String(a.dateSold || '')))
    .slice(0, 5);

  return (
    <>
      <Header
        eyebrow="Overview"
        title="Consignment dashboard"
        action={(
          <div className="consignment-header-actions">
            <button type="button" className="consignment-btn" onClick={onNewConsignor}>
              <Plus size={16} /> Add consignor
            </button>
            <button type="button" className="consignment-btn secondary" onClick={onNewItem}>
              <Plus size={16} /> Add item
            </button>
            <details className="consignment-data-menu">
              <summary className="consignment-btn secondary"><FileUp size={16} /> Import / Export</summary>
              <div className="consignment-data-menu-popover">
                <button type="button" onClick={onImport}><FileUp size={15} /> Import CSV</button>
                <button type="button" onClick={onExport}><Download size={15} /> Export CSV</button>
              </div>
            </details>
          </div>
        )}
      />
      <div className="consignment-body">
        <div className="consignment-toolbar" style={{ justifyContent: 'space-between' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
            Live sales, inventory, and consignor balances from Shopify.
          </p>
          <div className="consignment-date-tabs" aria-label="Dashboard period">
            <button type="button">Week</button>
            <button type="button" className="active">Month</button>
            <button type="button">Year</button>
            <button type="button">All time</button>
          </div>
        </div>

        <div className="consignment-dashboard-grid">
          <MetricCard icon={PackageSearch} label="Active items" value={activeItems.length} note={`${items.length} items total`} onClick={() => onNavigate('items')} />
          <MetricCard icon={Users} label="Consignors" value={consignors.length} note={`${consignorBalances.length} with payouts due`} onClick={() => onNavigate('home')} />
          <MetricCard icon={TrendingUp} label="Consignment sales" value={money(totalSales)} note={`${soldItems.length} sold items`} onClick={() => onNavigate('sales')} />
          <MetricCard icon={CircleDollarSign} label="Payouts due" value={money(amountDue)} note={`${unpaidSales.length} unpaid sales`} onClick={() => onNavigate('payouts')} />
        </div>

        <section className="consignment-card" style={{ marginBottom: 20 }}>
          <div className="consignment-section-title">
            <h2>Consignment Expiry</h2>
          </div>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13 }}>
            Optional term tracking. Expired items stay in inventory until you choose an action.
          </p>
          <div className="consignment-dashboard-grid">
            <button
              type="button"
              className="consignment-expiry-stat"
              onClick={() => onNavigate('items')}
              style={{ textAlign: 'left', background: 'var(--card-bg, #fff)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Expiring in 7 days</div>
              <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0' }}>{expiring7Items.length}</div>
              <span className="consignment-link-button">View items →</span>
            </button>
            <button
              type="button"
              className="consignment-expiry-stat"
              onClick={() => onNavigate('items')}
              style={{ textAlign: 'left', background: 'var(--card-bg, #fff)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Expiring in 30 days</div>
              <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0' }}>{expiring30Items.length}</div>
              <span className="consignment-link-button">View items →</span>
            </button>
            <button
              type="button"
              className="consignment-expiry-stat"
              onClick={() => onNavigate('items')}
              style={{ textAlign: 'left', background: 'var(--card-bg, #fff)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>Expired</div>
              <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0', color: expiredItems.length > 0 ? '#c0392b' : undefined }}>{expiredItems.length}</div>
              <span className="consignment-link-button">{expiredItems.length > 0 ? 'Action required →' : 'View items →'}</span>
            </button>
          </div>
        </section>


        <div className="consignment-section-grid">
          <section className="consignment-card">
            <div className="consignment-section-title">
              <h2>Consignors with payouts due</h2>
              <button type="button" className="consignment-link-button" onClick={() => onNavigate('payouts')}>View payouts</button>
            </div>
            {consignorBalances.length === 0 ? (
              <div className="consignment-empty-small">No unpaid consignment sales yet.</div>
            ) : consignorBalances.slice(0, 6).map(({ consignor, sales, due }) => (
              <button
                key={consignor.id}
                type="button"
                className="consignment-row-btn"
                onClick={() => onOpenConsignor(consignor.id)}
              >
                <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
                <div className="consignment-row-main">
                  <div className="consignment-row-name">{consignor.firstName} {consignor.lastName}</div>
                  <div className="consignment-row-sub">#{consignor.number} · {sales.length} unpaid sale{sales.length === 1 ? '' : 's'}</div>
                </div>
                <strong>{money(due)}</strong>
                <ChevronRight size={18} className="consignment-chev" />
              </button>
            ))}
          </section>

          <section className="consignment-card">
            <div className="consignment-section-title">
              <h2>Recent sales</h2>
              <button type="button" className="consignment-link-button" onClick={() => onNavigate('sales')}>View all</button>
            </div>
            {recentSales.length === 0 ? (
              <div className="consignment-empty-small">Paid Shopify orders will appear here automatically.</div>
            ) : recentSales.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: 13 }}>{item.description || item.itemNumber}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{item.itemNumber} · {item.dateSold || 'Sold'}</span>
                </div>
                <strong style={{ fontSize: 13 }}>{money(item.salePrice ?? item.price)}</strong>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

function ItemsScreen({ items, consignors, onOpenItem, onOpenConsignor, onMarkSold, onNewItem }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Current');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState('All');
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('list');
  const [sellingItemId, setSellingItemId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const statuses = ['Current', 'Draft', 'Available', 'Sold', 'Archived', 'Returned', 'Donated'];
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const matchesQuery = !q || `${item.description} ${item.itemNumber} ${item.type} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const product = productLabel(item);
    const matchesProduct = productFilter === 'All'
      || (productFilter === 'Manual' && product.className === 'manual')
      || (productFilter === 'POS' && product.text === 'POS')
      || (productFilter === 'Online' && product.text === 'Online')
      || (productFilter === 'POS + Online' && product.text === 'POS + Online');
    const matchesStatus = filter === 'Current'
      ? !item.paidOut
      : filter === 'Archived'
        ? item.paidOut
        : filter === 'Available'
          ? item.status === 'Available' || item.status === 'Active'
          : item.status === filter && !item.paidOut;
    return matchesQuery && matchesConsignor && matchesProduct && matchesStatus;
  }).sort((a, b) => {
    if (sort === 'oldest') return String(a.dateReceived || '').localeCompare(String(b.dateReceived || ''));
    if (sort === 'consignor') {
      const aName = `${consignorById[a.consignorId]?.lastName || ''} ${consignorById[a.consignorId]?.firstName || ''}`;
      const bName = `${consignorById[b.consignorId]?.lastName || ''} ${consignorById[b.consignorId]?.firstName || ''}`;
      return aName.localeCompare(bName) || a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true });
    }
    if (sort === 'ticket') return a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true });
    if (sort === 'priceHigh') return Number(b.price || 0) - Number(a.price || 0);
    if (sort === 'priceLow') return Number(a.price || 0) - Number(b.price || 0);
    return String(b.dateReceived || '').localeCompare(String(a.dateReceived || '')) || b.itemNumber.localeCompare(a.itemNumber, undefined, { numeric: true });
  });

  const grouped = filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());

  const groupedEntries = Array.from(grouped.entries()).sort(([aId, aItems], [bId, bItems]) => {
    if (sort !== 'consignor') return filtered.indexOf(aItems[0]) - filtered.indexOf(bItems[0]);
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  async function quickMarkSold(item) {
    if (sellingItemId) return;
    const amount = window.prompt(`Sale price for ${item.description || item.itemNumber}`, String(item.price ?? ''));
    if (amount === null) return;
    const salePrice = Number(amount);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSellingItemId(item.id);
    try {
      await onMarkSold(item.id, { salePrice, dateSold: new Date().toISOString().slice(0, 10) });
    } finally {
      setSellingItemId(null);
    }
  }

  function toggleGroup(consignorId) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(consignorId)) next.delete(consignorId);
      else next.add(consignorId);
      return next;
    });
  }

  function ConsignorName({ consignor }) {
    if (!consignor) return <span>Unassigned</span>;
    return (
      <button type="button" className="consignment-consignor-profile-link" onClick={() => onOpenConsignor(consignor.id)}>
        {consignor.firstName} {consignor.lastName}
      </button>
    );
  }

  function ItemAction({ item, product, compact = false }) {
    const isManualAvailable = product.className === 'manual' && (item.status === 'Available' || item.status === 'Active') && !item.paidOut;
    if (isManualAvailable) {
      return (
        <button type="button" className="consignment-quick-sold-btn" disabled={sellingItemId === item.id} onClick={() => quickMarkSold(item)}>
          {sellingItemId === item.id ? 'Saving…' : 'Mark sold'}
        </button>
      );
    }
    return (
      <button type="button" className={compact ? 'consignment-grid-open-btn' : 'consignment-item-open-btn'} onClick={() => onOpenItem(item.id)}>
        Open item
      </button>
    );
  }

  return (
    <>
      <Header
        eyebrow="Inventory"
        title="Items"
        action={(
          <button className="consignment-btn" type="button" onClick={onNewItem}>
            <Plus size={17} /> Add new item
          </button>
        )}
      />
      <div className="consignment-body">
        <div className="consignment-items-toolbar">
          <details className="consignment-items-filter-details">
            <summary className="consignment-items-filter-summary">
              <span>Filters &amp; sorting</span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <div className="consignment-items-toolbar-top">
            <label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)} aria-label="Filter by consignor">
              <option value="All">All consignors</option>
              {consignors.map((consignor) => <option key={consignor.id} value={consignor.id}>#{consignor.number} · {consignor.firstName} {consignor.lastName}</option>)}
            </select></label>
            <label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort items">
              <option value="consignor">Consignor name</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">SKU / item number</option><option value="priceHigh">Price high to low</option><option value="priceLow">Price low to high</option>
            </select></label>
            <label className="consignment-tool-field"><span>Product type</span><select className="consignment-select consignment-filter-select" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} aria-label="Filter by product type">
              <option value="All">All product types</option><option value="Manual">Manual</option><option value="POS">POS</option><option value="Online">Online</option><option value="POS + Online">POS + Online</option>
            </select></label>
            <label className="consignment-tool-field"><span>Status</span><select id="item-status-filter" className="consignment-select consignment-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {statuses.map((status) => {
                const count = status === 'Current' ? items.filter((item) => !item.paidOut).length : status === 'Archived' ? items.filter((item) => item.paidOut).length : items.filter((item) => item.status === status && !item.paidOut).length;
                return <option key={status} value={status}>{statusLabel(status)} ({count})</option>;
              })}
            </select></label>
            </div>
          </details>
          <div className="consignment-items-toolbar-bottom">
            <div className="consignment-search">
              <Search size={19} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, brand, or consignor" />
            </div>
            <div className="consignment-tool-view"><span>View</span><div className="consignment-view-toggle consignment-finder-toggle" aria-label="Choose item view">
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><List size={16} /> All items</button>
              <button type="button" className={viewMode === 'grouped' ? 'active' : ''} onClick={() => setViewMode('grouped')} aria-pressed={viewMode === 'grouped'}><Users size={16} /> By consignor</button>
              <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}><Grid3X3 size={16} /> Grid</button>
            </div></div>
          </div>
        </div>


        {filtered.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No items match these filters.</div></section>}

        {viewMode === 'grouped' && (
          <div className="consignment-item-groups">
            {groupedEntries.map(([consignorId, consignorItems]) => {
              const consignor = consignorById[consignorId];
              const availableCount = consignorItems.filter((item) => item.status === 'Available' || item.status === 'Active').length;
              const soldCount = consignorItems.filter((item) => item.status === 'Sold' || item.dateSold).length;
              const initials = consignor ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` : '—';
              const collapsed = collapsedGroups.has(consignorId);
              return (
                <section className="consignment-item-group" key={consignorId}>
                  <div className="consignment-item-group-summary">
                    <button type="button" className={`consignment-item-group-chevron ${collapsed ? '' : 'open'}`} onClick={() => toggleGroup(consignorId)} aria-label={collapsed ? 'Expand consignor items' : 'Collapse consignor items'}><ChevronRight size={16} /></button>
                    <span className="consignment-avatar consignment-item-group-avatar">{initials}</span>
                    <span className="consignment-item-group-person">
                      <ConsignorName consignor={consignor} />
                      <span className="consignment-item-group-meta"><strong className="consignment-item-group-number">#{consignor?.number || '—'}</strong><span className="consignment-item-group-count">· {consignorItems.length} item{consignorItems.length === 1 ? '' : 's'}</span></span>
                    </span>
                    <span className="consignment-item-group-stat"><strong>{availableCount}</strong><span>Available</span></span>
                    <span className="consignment-item-group-stat"><strong>{soldCount}</strong><span>Sold</span></span>
                  </div>
                  {!collapsed && (
                    <div className="consignment-item-group-items">
                      <div className="consignment-grouped-item-row consignment-list-head"><span>Item</span><span>Price</span><span>Commission</span><span>Product</span><span>Status</span><span>Action</span></div>
                      {consignorItems.map((item) => {
                        const product = productLabel(item);
                        return (
                          <div className="consignment-grouped-item-row" key={item.id}>
                            <button type="button" className="consignment-grouped-item-open" onClick={() => onOpenItem(item.id)}><span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}</span><span><strong>{item.description || item.type || 'Consignment item'}</strong><span>{item.itemNumber}{item.size ? ` · ${item.size}` : ''}{item.brand ? ` · ${item.brand}` : ''}</span></span></button>
                            <strong>{money(item.price)}</strong><span>{item.commissionPct}%</span><span className={`consignment-product-badge ${product.className}`}>{product.text}</span><span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid · archived' : statusLabel(item.status)}</span><span className="consignment-item-quick-action"><ItemAction item={item} product={product} /></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {viewMode === 'list' && (
          <section className="consignment-card consignment-all-items-card">
            <div className="consignment-list-row consignment-list-head"><span>Item</span><span>SKU</span><span>Consignor</span><span>Price</span><span>Commission</span><span>Product</span><span>Status</span><span>Action</span></div>
            {filtered.map((item) => {
              const consignor = consignorById[item.consignorId];
              const product = productLabel(item);
              return (
                <div className="consignment-all-item-row" key={item.id}>
                  <button type="button" className="consignment-grouped-item-open" onClick={() => onOpenItem(item.id)}><span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}</span><span><strong>{item.description || item.type || 'Consignment item'}</strong><span>{item.itemNumber}{item.size ? ` · ${item.size}` : ''}{item.brand ? ` · ${item.brand}` : ''}</span></span></button>
                  <strong>{item.itemNumber || '—'}</strong><ConsignorName consignor={consignor} /><strong>{money(item.price)}</strong><span>{item.commissionPct}%</span><span className={`consignment-product-badge ${product.className}`}>{product.text}</span><span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid · archived' : statusLabel(item.status)}</span><span className="consignment-item-quick-action"><ItemAction item={item} product={product} /></span>
                </div>
              );
            })}
          </section>
        )}

        {viewMode === 'grid' && (
          <div className="consignment-readable-grid">
            {filtered.map((item) => {
              const consignor = consignorById[item.consignorId];
              const product = productLabel(item);
              return (
                <article className="consignment-readable-card" key={item.id}>
                  <div className="consignment-readable-card-top">
                    <div className="consignment-grid-thumb-row">
                      <div className="consignment-grid-thumb">
                        {(item.shopifyPhoto || item.photo) ? (
                          <img src={item.shopifyPhoto || item.photo} alt="" />
                        ) : (
                          <Tag size={16} color="var(--muted)" />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong>{item.description || item.type || 'Consignment item'}</strong>
                        <small className="consignment-readable-card-sku"><b>SKU {item.itemNumber || '—'}</b>{item.size ? <span> · {item.size}</span> : null}</small>
                      </div>
                    </div>
                    <span className={`consignment-product-badge ${product.className}`}>{product.text}</span>
                  </div>

                  {consignor ? (
                    <button type="button" className="consignment-readable-consignor-link" onClick={() => onOpenConsignor(consignor.id)}>
                      {consignor.firstName} {consignor.lastName}
                    </button>
                  ) : (
                    <span className="consignment-readable-consignor-link" style={{ cursor: 'default', color: 'var(--muted)' }}>Unassigned</span>
                  )}

                  <div className="consignment-readable-card-meta consignment-sales-money-rows">
                    <span><small>Price</small><strong>{money(item.price)}</strong></span>
                    <span><small>Commission</small><strong>{item.commissionPct}%</strong></span>
                  </div>

                  <div className="consignment-readable-card-details">
                    <span><small>Status</small></span>
                    <span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid' : statusLabel(item.status)}</span>
                  </div>

                  <div className="consignment-readable-card-actions"><ItemAction item={item} product={product} compact /></div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function SalesScreen({ items, consignors, onStartPayout, onOpenConsignor }) {
  const [query, setQuery] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [consignorFilter, setConsignorFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortMode, setSortMode] = useState('newest');
  const [viewMode, setViewMode] = useState('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));
  const saleSource = (item) => {
    if (!item.shopifyProductId && !item.shopifyProduct) return 'manual';
    if (item.publishOnline || item.publishToOnlineStore) return 'online';
    return 'pos';
  };

  const allSales = items.filter((item) => item.status === 'Sold' || item.dateSold || item.orderId);
  const filteredSales = allSales
    .filter((item) => {
      const consignor = consignorById[item.consignorId];
      const q = query.trim().toLowerCase();
      const searchable = `${item.description || ''} ${item.itemNumber || ''} ${item.orderName || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''}`.toLowerCase();
      if (q && !searchable.includes(q)) return false;
      if (payoutFilter === 'paid' && !item.paidOut) return false;
      if (payoutFilter === 'unpaid' && item.paidOut) return false;
      if (consignorFilter !== 'all' && item.consignorId !== consignorFilter) return false;
      if (sourceFilter !== 'all' && saleSource(item) !== sourceFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const aConsignor = consignorById[a.consignorId];
      const bConsignor = consignorById[b.consignorId];
      const aPrice = Number(a.salePrice ?? a.price ?? 0);
      const bPrice = Number(b.salePrice ?? b.price ?? 0);
      const aDue = (aPrice * Number(a.commissionPct ?? aConsignor?.commissionPct ?? 0)) / 100;
      const bDue = (bPrice * Number(b.commissionPct ?? bConsignor?.commissionPct ?? 0)) / 100;
      if (sortMode === 'oldest') return String(a.dateSold || '').localeCompare(String(b.dateSold || ''));
      if (sortMode === 'price') return bPrice - aPrice;
      if (sortMode === 'due') return bDue - aDue;
      if (sortMode === 'consignor') return `${aConsignor?.lastName || ''} ${aConsignor?.firstName || ''}`.localeCompare(`${bConsignor?.lastName || ''} ${bConsignor?.firstName || ''}`);
      if (sortMode === 'sku') return String(a.itemNumber || '').localeCompare(String(b.itemNumber || ''), undefined, { numeric: true });
      return String(b.dateSold || '').localeCompare(String(a.dateSold || ''));
    });

  const groupedSales = Object.values(filteredSales.reduce((groups, item) => {
    const key = item.consignorId || 'unknown';
    if (!groups[key]) groups[key] = { consignor: consignorById[item.consignorId], sales: [] };
    groups[key].sales.push(item);
    return groups;
  }, {})).sort((a, b) => `${a.consignor?.lastName || ''} ${a.consignor?.firstName || ''}`.localeCompare(`${b.consignor?.lastName || ''} ${b.consignor?.firstName || ''}`));

  const totalSales = allSales.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const totalUnpaid = allSales.filter((item) => !item.paidOut).reduce((sum, item) => {
    const consignor = consignorById[item.consignorId];
    const salePrice = Number(item.salePrice ?? item.price ?? 0);
    return sum + (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
  }, 0);
  const unpaidCount = allSales.filter((item) => !item.paidOut).length;
  const paidCount = allSales.filter((item) => item.paidOut).length;

  const sourceLabel = (item) => {
    const source = saleSource(item);
    if (source === 'online') return { text: 'Online', className: 'online' };
    if (source === 'pos') return { text: 'POS', className: 'pos' };
    return { text: 'Manual', className: 'manual' };
  };

  const formatSaleDate = (value) => {
    if (!value) return 'Date unavailable';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const exportSales = () => {
    const headers = ['SKU', 'Item', 'Consignor', 'Source', 'Sale price', 'Consignor due', 'Payout status', 'Date sold', 'Order'];
    const rows = filteredSales.map((item) => {
      const consignor = consignorById[item.consignorId];
      const price = Number(item.salePrice ?? item.price ?? 0);
      const due = (price * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
      return [item.itemNumber || '', item.description || '', consignor ? `${consignor.firstName} ${consignor.lastName}` : '', sourceLabel(item).text, price, due, item.paidOut ? 'Paid' : 'Unpaid', item.dateSold || '', item.orderName || ''];
    });
    downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const ConsignorLink = ({ consignor }) => consignor ? (
    <button type="button" className="consignment-sales-consignor-link" onClick={() => onOpenConsignor?.(consignor.id)}>{consignor.firstName} {consignor.lastName}</button>
  ) : <span>—</span>;

  const PayoutAction = ({ item, consignor, compact = false }) => !item.paidOut && consignor ? (
    <button type="button" className={`consignment-sales-pay-btn${compact ? ' compact' : ''}`} onClick={() => onStartPayout(consignor.id)}>Pay consignor</button>
  ) : (
    <span className="consignment-sales-paid-note">Paid</span>
  );

  return (
    <>
      <Header
        eyebrow="Sales ledger"
        title="Sales"
        action={<button type="button" className="consignment-btn secondary" onClick={exportSales}><Download size={16} /> Export</button>}
      />
      <div className="consignment-body consignment-sales-page">
        <div className="consignment-sales-summary-grid">
          <div className="consignment-sales-summary-card"><span>Total sales</span><strong>{money(totalSales)}</strong></div>
          <div className="consignment-sales-summary-card"><span>Unpaid to consignors</span><strong>{money(totalUnpaid)}</strong></div>
          <div className="consignment-sales-summary-card"><span>Unpaid sales</span><strong>{unpaidCount}</strong></div>
          <div className="consignment-sales-summary-card"><span>Paid sales</span><strong>{paidCount}</strong></div>
        </div>

        <div className="consignment-items-toolbar">
        <details className="consignment-items-filter-details" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
          <summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} /></summary>
          <div className="consignment-items-toolbar-top">
            <label className="consignment-tool-field"><span>Payout status</span><select className="consignment-select consignment-filter-select" value={payoutFilter} onChange={(event) => setPayoutFilter(event.target.value)}><option value="all">All payout statuses</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label>
            <label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)}><option value="all">All consignors</option>{consignors.slice().sort((a,b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)).map((consignor) => <option key={consignor.id} value={consignor.id}>{consignor.firstName} {consignor.lastName}</option>)}</select></label>
            <label className="consignment-tool-field"><span>Sale source</span><select className="consignment-select consignment-filter-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All sale sources</option><option value="manual">Manual</option><option value="pos">POS</option><option value="online">Online</option></select></label>
            <label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="price">Highest sale price</option><option value="due">Highest consignor due</option><option value="consignor">Consignor name</option><option value="sku">SKU</option></select></label>
          </div>
        </details>

        <div className="consignment-items-toolbar-bottom">
          <div className="consignment-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, brand, or consignor" /></div>
          <div className="consignment-tool-view"><span>View</span><div className="consignment-view-toggle consignment-finder-toggle" aria-label="Choose sales view"><button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><List size={16} /> All items</button><button type="button" className={viewMode === 'grouped' ? 'active' : ''} onClick={() => setViewMode('grouped')} aria-pressed={viewMode === 'grouped'}><Users size={16} /> By consignor</button><button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}><Grid3X3 size={16} /> Grid</button></div></div>
        </div>
        </div>

        {filteredSales.length === 0 && <div className="consignment-empty-small">No sales match the selected filters.</div>}

        {viewMode === 'list' && filteredSales.length > 0 && (
          <>
            <div className="consignment-sales-scroll-hint" aria-hidden="true">Swipe to see more <span>→</span></div>
            <section className="consignment-card consignment-sales-table-card">
            <div className="consignment-sales-multi-row consignment-list-head"><span>Sale</span><span>SKU</span><span>Consignor</span><span>Source</span><span>Sale price</span><span>Consignor due</span><span>Payout</span><span>Action</span></div>
            {filteredSales.map((item) => {
              const consignor = consignorById[item.consignorId];
              const salePrice = Number(item.salePrice ?? item.price ?? 0);
              const due = (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
              const source = sourceLabel(item);
              return <div className="consignment-sales-multi-row" key={item.id}><span className="consignment-item-primary"><span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <ReceiptText size={16} color="var(--green-dark)" />}</span><span><strong>{item.description || item.itemNumber}</strong><span>{item.orderName || (source.text === 'Manual' ? 'Manual sale' : 'Shopify order')} · {item.dateSold || 'Paid'}</span></span></span><strong>{item.itemNumber || '—'}</strong><ConsignorLink consignor={consignor} /><span className={`consignment-product-badge ${source.className}`}>{source.text}</span><strong>{money(salePrice)}</strong><strong>{money(due)}</strong><span className={`consignment-badge ${item.paidOut ? 'available' : 'draft'}`}>{item.paidOut ? 'Paid' : 'Unpaid'}</span><span className="consignment-sales-action"><PayoutAction item={item} consignor={consignor} /></span></div>;
            })}
            </section>
          </>
        )}

        {viewMode === 'grouped' && filteredSales.length > 0 && (
          <div className="consignment-sales-groups">
            {groupedSales.map(({ consignor, sales }) => {
              const groupTotal = sales.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
              const groupDue = sales.filter((item) => !item.paidOut).reduce((sum, item) => {
                const price = Number(item.salePrice ?? item.price ?? 0);
                return sum + (price * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
              }, 0);
              return (
                <details className="consignment-sales-group" open key={consignor?.id || 'unknown'}>
                  <summary>
                    <span className="consignment-sales-group-chevron">›</span>
                    <span className="consignment-sales-avatar">{`${consignor?.firstName?.[0] || '?'}${consignor?.lastName?.[0] || ''}`}</span>
                    <span className="consignment-sales-group-person"><ConsignorLink consignor={consignor} /><small>Consignor #{consignor?.number || '—'} · {sales.length} sales</small></span>
                    <span className="consignment-sales-group-stat"><strong>{money(groupTotal)}</strong><small>Total sales</small></span>
                    <span className="consignment-sales-group-stat"><strong>{money(groupDue)}</strong><small>Total owed</small></span>
                    <span className="consignment-sales-group-stat"><strong>{sales.filter((item) => !item.paidOut).length}</strong><small>Unpaid</small></span>
                  </summary>
                  <div className="consignment-sales-scroll-hint" aria-hidden="true">Swipe to see more <span>→</span></div>
                  <div className="consignment-sales-group-list consignment-sales-table-card">
                    <div className="consignment-sales-multi-row consignment-list-head"><span>Sale</span><span>SKU</span><span>Consignor</span><span>Source</span><span>Sale price</span><span>Consignor due</span><span>Payout</span><span>Action</span></div>
                    {sales.map((item) => {
                      const salePrice = Number(item.salePrice ?? item.price ?? 0);
                      const due = (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
                      const source = sourceLabel(item);
                      return <div className="consignment-sales-multi-row" key={item.id}><span className="consignment-item-primary"><span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <ReceiptText size={16} color="var(--green-dark)" />}</span><span><strong>{item.description || item.itemNumber}</strong><span>{item.orderName || (source.text === 'Manual' ? 'Manual sale' : 'Shopify order')} · {item.dateSold || 'Paid'}</span></span></span><strong>{item.itemNumber || '—'}</strong><ConsignorLink consignor={consignor} /><span className={`consignment-product-badge ${source.className}`}>{source.text}</span><strong>{money(salePrice)}</strong><strong>{money(due)}</strong><span className={`consignment-badge ${item.paidOut ? 'available' : 'draft'}`}>{item.paidOut ? 'Paid' : 'Unpaid'}</span><span className="consignment-sales-action"><PayoutAction item={item} consignor={consignor} /></span></div>;
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {viewMode === 'grid' && filteredSales.length > 0 && (
          <div className="consignment-readable-grid">
            {filteredSales.map((item) => {
              const consignor = consignorById[item.consignorId];
              const salePrice = Number(item.salePrice ?? item.price ?? 0);
              const due = (salePrice * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100;
              const source = sourceLabel(item);
              return (
                <article className="consignment-readable-card" key={item.id}>
                  <div className="consignment-readable-card-top">
                    <div className="consignment-grid-thumb-row">
                      <div className="consignment-grid-thumb">
                        {(item.shopifyPhoto || item.photo) ? (
                          <img src={item.shopifyPhoto || item.photo} alt="" />
                        ) : (
                          <Tag size={16} color="var(--muted)" />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong>{item.description || item.itemNumber}</strong>
                        <small><b>SKU:</b> {item.itemNumber || '—'}</small>
                      </div>
                    </div>
                    <span className={`consignment-product-badge ${source.className}`}>{source.text}</span>
                  </div>

                  <ConsignorLink consignor={consignor} />

                  <div className="consignment-readable-card-meta consignment-sales-money-rows">
                    <span><small>Sale price</small><strong>{money(salePrice)}</strong></span>
                    <span><small>Consignor due</small><strong>{money(due)}</strong></span>
                  </div>

                  <div className="consignment-readable-card-details">
                    <span><small>Sale date</small><strong>{formatSaleDate(item.dateSold)}</strong></span>
                    <span className={`consignment-badge ${item.paidOut ? 'available' : 'draft'}`}>{item.paidOut ? 'Paid' : 'Unpaid'}</span>
                  </div>

                  <div className="consignment-sales-grid-order">{item.orderName || (source.text === 'Manual' ? 'Manual sale' : 'Shopify order')}</div>
                  <div className="consignment-readable-card-actions"><PayoutAction item={item} consignor={consignor} compact /></div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <style>{`
        .consignment-sales-header-tools { display:flex; align-items:center; gap:10px; min-width:min(680px, 58vw); }
        .consignment-sales-search { position:relative; flex:1; }
        .consignment-sales-search > span { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); }
        .consignment-sales-search input { width:100%; min-height:40px; padding:9px 12px 9px 35px; border:1px solid var(--border); border-radius:10px; background:#fff; }
        .consignment-sales-page { padding-top:16px; }
        .consignment-sales-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
        .consignment-sales-summary-card { background:#fff; border:1px solid var(--border); border-radius:12px; padding:16px 18px; }
        .consignment-sales-summary-card span { display:block; color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; }
        .consignment-sales-summary-card strong { display:block; margin-top:5px; font-size:22px; }
        .consignment-sales-filter-dropdown { margin-bottom:18px; overflow:hidden; border:1px solid var(--border); border-radius:12px; background:#fff; }
        .consignment-sales-filter-dropdown > summary { min-height:58px; display:flex; align-items:center; justify-content:space-between; padding:13px 18px; list-style:none; color:var(--ink); font-size:15px; font-weight:800; cursor:pointer; }
        .consignment-sales-filter-dropdown > summary::-webkit-details-marker { display:none; }
        .consignment-sales-filter-dropdown > summary svg { color:var(--muted); transition:transform .18s; }
        .consignment-sales-filter-dropdown[open] > summary svg { transform:rotate(180deg); }
        .consignment-sales-filter-fields { display:grid; grid-template-columns:repeat(4,minmax(135px,1fr)); gap:12px; align-items:end; padding:16px 18px 18px; border-top:1px solid var(--border); }
        .consignment-sales-filter-fields .consignment-tool-field > span { display:block; margin-bottom:6px; color:var(--muted); font-size:10px; font-weight:700; text-transform:uppercase; }
        .consignment-sales-filter-fields select { width:100%; min-height:40px; padding:9px 10px; border:1px solid var(--border); border-radius:9px; background:#fff; }
        .consignment-sales-toolbar { display:grid; grid-template-columns:minmax(280px,.9fr) minmax(460px,1.1fr); gap:16px; align-items:end; margin-bottom:18px; }
        .consignment-sales-toolbar > .consignment-search { min-height:52px; margin:0; padding:0 16px; border-radius:12px; }
        .consignment-sales-toolbar > .consignment-search input { min-height:50px; font-size:16px; }
        .consignment-sales-view .consignment-view-toggle { min-height:52px; }
        .consignment-sales-view .consignment-view-toggle button { flex:1; min-height:50px; display:flex; align-items:center; justify-content:center; gap:8px; }
        .consignment-sales-scroll-hint { display:none; }
        .consignment-sales-filter-row > label > span { display:block; margin-bottom:6px; color:var(--muted); font-size:10px; font-weight:700; text-transform:uppercase; }
        .consignment-sales-filter-row select { width:100%; min-height:40px; padding:9px 10px; border:1px solid var(--border); border-radius:9px; background:#fff; }
        .consignment-sales-view-toggle { display:flex; overflow:hidden; border:1px solid var(--border); border-radius:9px; background:#fff; }
        .consignment-sales-view-toggle button { min-height:40px; padding:9px 12px; border:0; border-right:1px solid var(--border); background:#fff; color:var(--muted); font-weight:700; white-space:nowrap; }
        .consignment-sales-view-toggle button:last-child { border-right:0; }
        .consignment-sales-view-toggle button.active { background:var(--green-soft); color:var(--green); }
        .consignment-sales-table-card { padding:0; overflow:hidden; }
        .consignment-sales-multi-row { display:grid; grid-template-columns:minmax(210px,1.35fr) 85px minmax(130px,1fr) 95px 95px 110px 85px 120px; gap:12px; align-items:center; padding:12px 14px; border-bottom:1px solid var(--border); font-size:12px; }
        .consignment-sales-multi-row:last-child { border-bottom:0; }
        .consignment-sales-consignor-link { padding:0; border:0; background:none; color:var(--green); font:inherit; font-weight:700; text-align:left; cursor:pointer; }
        .consignment-sales-consignor-link:hover { text-decoration:underline; }
        .consignment-sales-pay-btn { border:0; border-radius:8px; background:var(--green); color:#fff; padding:8px 10px; font-size:11px; font-weight:700; white-space:nowrap; cursor:pointer; }
        .consignment-sales-pay-btn.compact { width:100%; }
        .consignment-sales-money-rows { grid-template-columns:1fr; gap:0; }
        .consignment-sales-money-rows > span { flex-direction:row; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; }
        .consignment-sales-money-rows > span + span { border-top:1px solid var(--border); }
        .consignment-sales-money-rows strong { white-space:nowrap; overflow-wrap:normal; }
        .consignment-sales-paid-note { color:var(--green-dark); font-size:11px; font-weight:700; }
        .consignment-sales-group { margin-bottom:10px; overflow:hidden; border:1px solid var(--border); border-radius:12px; background:#fff; }
        .consignment-sales-group > summary { display:grid; grid-template-columns:auto auto minmax(0,1fr) auto auto auto; gap:12px; align-items:center; padding:13px 14px; list-style:none; cursor:pointer; }
        .consignment-sales-group > summary::-webkit-details-marker { display:none; }
        .consignment-sales-group-chevron { width:26px; height:26px; display:grid; place-items:center; border:1px solid var(--border); border-radius:50%; transition:transform .2s; }
        .consignment-sales-group[open] .consignment-sales-group-chevron { transform:rotate(90deg); }
        .consignment-sales-avatar { width:36px; height:36px; display:grid; place-items:center; border-radius:9px; background:var(--green-soft); color:var(--green); font-size:11px; font-weight:800; }
        .consignment-sales-group-person { display:flex; flex-direction:column; gap:2px; }
        .consignment-sales-group-person small, .consignment-sales-group-stat small { color:var(--muted); font-size:9px; }
        .consignment-sales-group-stat { display:flex; flex-direction:column; text-align:right; }
        .consignment-sales-group-list { border-top:1px solid var(--border); }
        .consignment-sales-group-row { display:grid; grid-template-columns:minmax(230px,1fr) 90px 100px 90px 120px; gap:12px; align-items:center; padding:11px 14px; border-bottom:1px solid var(--border); font-size:12px; }
        .consignment-sales-group-row:last-child { border-bottom:0; }
        .consignment-sales-grid-view { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; align-items:stretch; }
        .consignment-sales-grid-card { min-width:0; min-height:270px; display:flex; flex-direction:column; padding:16px; border:1px solid var(--border); border-radius:12px; background:#fff; box-shadow:0 1px 2px rgba(16,24,40,.04); }
        .consignment-sales-grid-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
        .consignment-sales-grid-top > div { min-width:0; }
        .consignment-sales-grid-top strong { display:block; overflow:hidden; color:var(--text); font-size:17px; line-height:1.25; white-space:nowrap; text-overflow:ellipsis; }
        .consignment-sales-grid-top small { display:block; margin-top:5px; color:var(--muted); font-size:11px; }
        .consignment-sales-grid-top small b { color:var(--text); }
        .consignment-sales-grid-card > .consignment-sales-consignor-link { margin-top:12px; color:var(--green); font-size:14px; font-weight:800; }
        .consignment-sales-grid-meta { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:16px 0 14px; padding:14px 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
        .consignment-sales-grid-meta span, .consignment-sales-grid-details > span:first-child { display:flex; flex-direction:column; gap:3px; }
        .consignment-sales-grid-meta small, .consignment-sales-grid-details small { color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; }
        .consignment-sales-grid-meta strong { color:var(--text); font-size:21px; line-height:1.1; }
        .consignment-sales-grid-details { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .consignment-sales-grid-details strong { color:var(--text); font-size:13px; }
        .consignment-sales-grid-details .consignment-badge { min-width:78px; padding:6px 10px; font-size:10px; }
        .consignment-sales-grid-order { margin-bottom:14px; color:var(--muted); font-size:11px; }
        .consignment-sales-grid-actions { margin-top:auto; }
        .consignment-sales-grid-actions .consignment-sales-pay-btn { width:100%; min-height:42px; font-size:13px; }
        .consignment-sales-grid-actions .consignment-sales-paid-note { width:100%; min-height:42px; display:flex; align-items:center; justify-content:center; border:1px solid var(--border); border-radius:8px; background:#f7f8f9; }
        @media (max-width:1100px) { .consignment-sales-grid-view { grid-template-columns:repeat(3,minmax(0,1fr)); } .consignment-sales-filter-fields { grid-template-columns:repeat(2,minmax(0,1fr)); } .consignment-sales-toolbar { grid-template-columns:1fr; } .consignment-sales-multi-row { min-width:1000px; } .consignment-sales-table-card { overflow-x:auto; } }
        @media (max-width:760px) {
          .consignment-sales-header-tools { min-width:0; width:100%; flex-direction:column; align-items:stretch; }
          .consignment-sales-summary-grid { grid-template-columns:1fr 1fr; }
          .consignment-sales-summary-card { padding:14px; }
          .consignment-sales-summary-card strong { font-size:19px; }
          .consignment-sales-toolbar { grid-template-columns:1fr; align-items:stretch; }
          .consignment-sales-filter-dropdown > summary { min-height:50px; padding:11px 14px; font-size:13px; }
          .consignment-sales-filter-fields { grid-template-columns:1fr; gap:9px; padding:12px; border-top:1px solid var(--border); }
          .consignment-sales-view { grid-column:auto; }
          .consignment-sales-view .consignment-view-toggle { width:100%; }
          .consignment-sales-view .consignment-view-toggle button { flex:1; }
          .consignment-sales-scroll-hint { display:flex; align-items:center; justify-content:flex-end; gap:5px; margin:-2px 2px 7px; color:var(--green-dark); font-size:11px; font-weight:700; }
          .consignment-sales-scroll-hint span { font-size:16px; }
          .consignment-sales-table-card { position:relative; box-shadow:inset -14px 0 14px -16px rgba(20,63,115,.75); }
          .consignment-sales-group > summary { grid-template-columns:auto auto minmax(0,1fr); }
          .consignment-sales-group-stat { display:none; }
          .consignment-sales-group-row { grid-template-columns:1fr auto; }
          .consignment-sales-group-row > *:not(.consignment-item-primary):not(.consignment-sales-pay-btn):not(.consignment-sales-paid-note) { display:none; }
          .consignment-sales-grid-view { grid-template-columns:repeat(2,minmax(0,1fr)); justify-content:stretch; }
          .consignment-sales-grid-card { min-height:250px; padding:13px; }
          .consignment-sales-grid-meta strong { font-size:18px; }
        }
      `}</style>
    </>
  );
}

function PayoutsScreen({ items, consignors, onOpenConsignor, onStartPayout }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('amount');
  const [viewMode, setViewMode] = useState('list');
  const [tab, setTab] = useState('outstanding');
  const [expandedPayoutId, setExpandedPayoutId] = useState('');
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));
  const unpaidSales = items.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut);
  const rows = consignors
    .map((consignor) => {
      const sales = unpaidSales.filter((item) => item.consignorId === consignor.id);
      const due = sales.reduce(
        (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
        0,
      );
      return { consignor, sales, due };
    })
    .filter((entry) => entry.sales.length > 0)
    .filter(({ consignor }) => {
      const q = query.trim().toLowerCase();
      return !q || `${consignor.firstName} ${consignor.lastName} ${consignor.number}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'name') return `${a.consignor.lastName} ${a.consignor.firstName}`.localeCompare(`${b.consignor.lastName} ${b.consignor.firstName}`);
      if (sort === 'oldest') return String(a.sales[0]?.dateSold || '').localeCompare(String(b.sales[0]?.dateSold || ''));
      return b.due - a.due;
    });
  const allConsignorRows = consignors
    .map((consignor) => {
      const sales = items.filter((item) => item.consignorId === consignor.id);
      const due = sales
        .filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut)
        .reduce(
          (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
          0,
        );
      return { consignor, sales, due };
    })
    .filter(({ consignor }) => {
      const q = query.trim().toLowerCase();
      return !q || `${consignor.firstName} ${consignor.lastName} ${consignor.number}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'amount') return b.due - a.due;
      return `${a.consignor.lastName} ${a.consignor.firstName}`.localeCompare(`${b.consignor.lastName} ${b.consignor.firstName}`);
    });
  const displayedRows = viewMode === 'list' ? rows : allConsignorRows;
  const totalDue = rows.reduce((sum, entry) => sum + entry.due, 0);
  const payoutHistory = Object.values(items.filter((item) => item.paidOut && item.payoutId).reduce((groups, item) => {
    if (!groups[item.payoutId]) groups[item.payoutId] = { ...item, items: [], amount: item.payoutTotal || 0 };
    groups[item.payoutId].items.push(item);
    return groups;
  }, {})).sort((a, b) => String(b.payoutDate || '').localeCompare(String(a.payoutDate || '')));

  return (
    <>
      <Header eyebrow="Payments" title="Payouts" />
      <div className="consignment-body consignment-payouts-page">
        <div className="consignment-status-row">
          <button type="button" className={`consignment-chip ${tab === 'outstanding' ? 'active' : ''}`} onClick={() => setTab('outstanding')}>Outstanding</button>
          <button type="button" className={`consignment-chip ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            Payout history <span className="consignment-tab-count">{payoutHistory.length}</span>
          </button>
        </div>
        {tab === 'outstanding' && (
          <>
        <div className="consignment-payout-summary">
          <div className="consignment-summary-box"><span>Total due</span><strong>{money(totalDue)}</strong></div>
          <div className="consignment-summary-box"><span>Consignors to pay</span><strong>{rows.length}</strong></div>
        </div>

        <div className="consignment-items-toolbar">
          <details className="consignment-items-filter-details">
            <summary className="consignment-items-filter-summary"><span>Filters &amp; sorting</span><ChevronDown size={20} aria-hidden="true" /></summary>
            <div className="consignment-items-toolbar-top">
              <label className="consignment-tool-field"><span>Sort</span>
                <select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort payouts">
                  <option value="amount">Highest amount due</option>
                  <option value="name">Consignor name</option>
                  <option value="oldest">Oldest unpaid sale</option>
                </select>
              </label>
            </div>
          </details>
          <div className="consignment-items-toolbar-bottom">
          <div className="consignment-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search consignor or number" />
          </div>
          <div className="consignment-tool-view">
            <span>View</span>
            <div className="consignment-view-toggle consignment-finder-toggle" aria-label="Choose payout view">
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><List size={16} /> All payouts</button>
              <button type="button" className={viewMode === 'grouped' ? 'active' : ''} onClick={() => setViewMode('grouped')} aria-pressed={viewMode === 'grouped'}><Users size={16} /> By consignor</button>
              <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}><Grid3X3 size={16} /> Grid</button>
            </div>
          </div>
          </div>
        </div>
        {viewMode !== 'grid' && (
        <section className={`consignment-card consignment-payout-list list`}>
          <div className="consignment-section-title">
            <h2>{viewMode === 'grouped' ? 'All consignors' : 'Consignors with payouts due'}</h2>
            <CalendarDays size={18} color="var(--muted)" />
          </div>
          {displayedRows.length === 0 && <div className="consignment-empty-small">{viewMode === 'grouped' ? 'No consignors match this search.' : 'There are no eligible unpaid sales.'}</div>}
          {viewMode === 'grouped' && displayedRows.map(({ consignor, sales, due }) => {
            const availableCount = sales.filter((item) => item.status === 'Available' || item.status === 'Active').length;
            const unpaidCount = sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).length;
            return (
            <details className="consignment-payout-row consignment-payout-group" open={unpaidCount > 0} key={consignor.id}>
              <summary className="consignment-payout-group-summary">
                <ChevronRight size={16} className="consignment-payout-chev" aria-hidden="true" />
                <span
                  className="consignment-payout-person"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenConsignor(consignor.id); }}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onOpenConsignor(consignor.id); } }}
                >
                  <span className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</span>
                  <span className="consignment-row-main">
                    <span className="consignment-row-name">{consignor.firstName} {consignor.lastName}</span>
                    <span className="consignment-row-sub">#{consignor.number} · {sales.length} item{sales.length === 1 ? '' : 's'}</span>
                  </span>
                </span>
                <span className="consignment-payout-group-stat"><strong>{availableCount}</strong><span>Available</span></span>
                <span className="consignment-payout-group-stat"><strong>{unpaidCount}</strong><span>Unpaid</span></span>
                <span className="consignment-payout-action">
                  <strong className="consignment-payout-amount">{money(due)}</strong>
                  <button
                    type="button"
                    className="consignment-btn"
                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); onStartPayout(consignor.id); }}
                  >
                    Go to payout
                  </button>
                </span>
              </summary>
              {sales.length > 0 && (
                <div className="consignment-payout-all-items">
                  {sales.map((item) => (
                    <div className="consignment-history-item" key={item.id}>
                      <span className="consignment-batch-thumb">
                        {item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}
                      </span>
                      <span className="consignment-history-item-copy">
                        <strong>{item.description || item.itemNumber}</strong>
                        <span>SKU {item.itemNumber} · {item.status || 'Draft'} · {money(item.salePrice ?? item.price)}</span>
                      </span>
                      <span className={`consignment-badge ${item.paidOut ? 'paid' : ''}`}>{item.paidOut ? 'Paid' : ((item.status === 'Sold' || item.dateSold) ? 'Unpaid' : 'Not sold')}</span>
                    </div>
                  ))}
                </div>
              )}
            </details>
            );
          })}
          {viewMode === 'list' && displayedRows.map(({ consignor, sales, due }) => (
            <div key={consignor.id} className="consignment-payout-row">
              <button
                type="button"
                className="consignment-payout-person"
                onClick={() => onOpenConsignor(consignor.id)}
              >
                <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
                <div className="consignment-row-main">
                  <div className="consignment-row-name">{consignor.firstName} {consignor.lastName}</div>
                  <div className="consignment-row-sub">#{consignor.number} · {sales.length} eligible item{sales.length === 1 ? '' : 's'}</div>
                </div>
              </button>
              <div className="consignment-payout-action">
                <strong className="consignment-payout-amount">{money(due)}</strong>
                {due > 0 && <button type="button" className="consignment-btn" onClick={() => onStartPayout(consignor.id)}>Review & pay</button>}
              </div>
            </div>
          ))}
        </section>
        )}
        {viewMode === 'grid' && (
          <>
            {displayedRows.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No consignors match this search.</div></section>}
            <div className="consignment-consignor-card-grid">
              {displayedRows.map(({ consignor, sales, due }) => {
                const availableCount = sales.filter((item) => item.status === 'Available' || item.status === 'Active').length;
                const unpaidCount = sales.filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut).length;
                const paidCount = sales.filter((item) => item.paidOut).length;
                return (
                  <article className="consignment-consignor-card" key={consignor.id}>
                    <div className="consignment-consignor-card-top">
                      <span className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</span>
                      <span className="consignment-consignor-card-name">
                        <strong>{consignor.firstName} {consignor.lastName}</strong>
                        <small>#{consignor.number} · {sales.length} item{sales.length === 1 ? '' : 's'}</small>
                      </span>
                    </div>
                    <div className="consignment-consignor-card-stats stats-3">
                      <span><strong>{availableCount}</strong><small>Available</small></span>
                      <span><strong>{unpaidCount}</strong><small>Unpaid</small></span>
                      <span><strong>{paidCount}</strong><small>Paid</small></span>
                    </div>
                    <div className="consignment-consignor-card-due"><small>Total due</small><strong>{money(due)}</strong></div>
                    <button type="button" className="consignment-consignor-card-open" onClick={() => onStartPayout(consignor.id)}>Go to payout</button>
                  </article>
                );
              })}
            </div>
          </>
        )}
          </>
        )}
        {tab === 'history' && (
          <section className="consignment-history-list">
            {payoutHistory.length === 0 && <div className="consignment-empty-small">Recorded payouts will appear here.</div>}
            {payoutHistory.map((payout) => {
              const consignor = consignorById[payout.consignorId];
              const consignorName = consignor
                ? `${consignor.firstName} ${consignor.lastName}`
                : 'Unknown consignor';
              const expanded = expandedPayoutId === payout.payoutId;
              return (
                <article className="consignment-history-card" key={payout.payoutId}>
                  <button
                    type="button"
                    className="consignment-history-card-summary"
                    onClick={() => setExpandedPayoutId(expanded ? '' : payout.payoutId)}
                    aria-expanded={expanded}
                  >
                    <span className="consignment-avatar">
                      {consignor?.firstName?.[0] || '?'}{consignor?.lastName?.[0] || ''}
                    </span>
                    <span className="consignment-history-card-copy">
                      {consignor ? (
                        <span
                          className="consignment-history-consignor-link"
                          role="link"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenConsignor(consignor.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              onOpenConsignor(consignor.id);
                            }
                          }}
                        >
                          {consignorName} · #{consignor.number}
                        </span>
                      ) : (
                        <strong>{consignorName}</strong>
                      )}
                      <span>{payout.payoutDate || 'Date not recorded'} · {payout.items.length} item{payout.items.length === 1 ? '' : 's'}</span>
                    </span>
                    <span className="consignment-history-card-amount">
                      <strong>{money(payout.amount)}</strong>
                      <span>{payout.payoutMethod || 'Method not recorded'}</span>
                    </span>
                    <span className="consignment-badge paid">Paid</span>
                    <ChevronRight
                      size={17}
                      color="var(--muted)"
                      style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
                    />
                  </button>
                  {expanded && (
                    <div className="consignment-history-card-details">
                      <div className="consignment-history-meta">
                        <div><span>Paid to</span><strong>{consignorName}</strong></div>
                        <div><span>Payment method</span><strong>{payout.payoutMethod || 'Not recorded'}</strong></div>
                        <div><span>Reference</span><strong>{payout.payoutReference || payout.payoutId}</strong></div>
                      </div>
                      {payout.items.map((item) => {
                        const salePrice = Number(item.salePrice ?? item.price ?? 0);
                        const rate = Number(item.commissionPct ?? consignor?.commissionPct ?? 0);
                        return (
                          <div className="consignment-history-item" key={item.id}>
                            <span className="consignment-batch-thumb">
                              {item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}
                            </span>
                            <span className="consignment-history-item-copy">
                              <strong>{item.description || item.itemNumber}</strong>
                              <span>{item.itemNumber} · {item.orderName || 'No order reference'} · {money(salePrice)} × {rate}%</span>
                            </span>
                            <strong>{money(item.payoutAmount)}</strong>
                          </div>
                        );
                      })}
                      {Number(payout.payoutAdjustment || 0) !== 0 && (
                        <div className="consignment-history-note">Manual adjustment: {money(payout.payoutAdjustment)}</div>
                      )}
                      {payout.payoutNote && <div className="consignment-history-note">Note: {payout.payoutNote}</div>}
                      {payout.payoutMethod === 'Store credit' && (
                        <div className="consignment-history-note"><strong>Store credit recorded:</strong> {money(payout.amount)}</div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}

function CreatePayoutScreen({ consignor, items, onBack, onRecordPayout }) {
  const eligible = items.filter(
    (item) => item.consignorId === consignor.id && (item.status === 'Sold' || item.dateSold) && !item.paidOut,
  );
  const [selectedIds, setSelectedIds] = useState(() => eligible.map((item) => item.id));
  const [adjustment, setAdjustment] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('E-transfer');
  const [reference, setReference] = useState('');
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const selected = eligible.filter((item) => selectedIds.includes(item.id));
  const itemTotal = selected.reduce(
    (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
    0,
  );
  const payoutTotal = itemTotal + Number(adjustment || 0);

  function toggleItem(id) {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    ));
  }

  return (
    <>
      <Header eyebrow={`Consignor #${consignor.number}`} title="Create payout" onBack={onBack} />
      <div className="consignment-body consignment-payout-create-body">
        <div className="consignment-section-grid">
          <section>
            <div className="consignment-card">
              <div className="consignment-section-title">
                <div>
                  <h2>{consignor.firstName} {consignor.lastName}</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                    Default commission: {consignor.commissionPct}%
                  </p>
                </div>
                <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
              </div>
            </div>

            <div className="consignment-card">
              <div className="consignment-section-title">
                <div>
                  <h2>Items in this payout</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                    Select the eligible sales to include.
                  </p>
                </div>
                <button
                  type="button"
                  className="consignment-link-button"
                  onClick={() => setSelectedIds(selectedIds.length === eligible.length ? [] : eligible.map((item) => item.id))}
                >
                  {selectedIds.length === eligible.length ? 'Exclude all' : 'Select all'}
                </button>
              </div>

              {eligible.length === 0 && <div className="consignment-empty-small">This consignor has no eligible unpaid sales.</div>}
              {eligible.map((item) => {
                const salePrice = Number(item.salePrice ?? item.price ?? 0);
                const rate = Number(item.commissionPct ?? consignor.commissionPct ?? 0);
                const due = (salePrice * rate) / 100;
                return (
                  <label key={item.id} className="consignment-row-btn" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                      style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
                    />
                    <span className="consignment-item-primary" style={{ flex: 1 }}>
                      <span className="consignment-batch-thumb">
                        {item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}
                      </span>
                      <span>
                        <strong>{item.description || item.itemNumber}</strong>
                        <span>{item.orderName || item.itemNumber} · {money(salePrice)} × {rate}%</span>
                      </span>
                    </span>
                    <strong>{money(due)}</strong>
                  </label>
                );
              })}
            </div>
          </section>

          <aside>
            <div className="consignment-card">
              <div className="consignment-section-title"><h2>Payout summary</h2></div>
              <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Selected sales</span><strong>{selected.length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Consignor earnings</span><strong>{money(itemTotal)}</strong></div>
                <div className="consignment-field" style={{ margin: '4px 0 0' }}>
                  <label className="consignment-label">Manual adjustment</label>
                  <input className="consignment-input" type="number" inputMode="decimal" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="0.00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 16 }}>
                  <strong>Amount due</strong><strong>{money(payoutTotal)}</strong>
                </div>
              </div>
            </div>
            <div className="consignment-card">
              <div className="consignment-field">
                <label className="consignment-label">Payment method</label>
                <select className="consignment-select" value={method} onChange={(event) => setMethod(event.target.value)}>
                  <option>E-transfer</option><option>Cash</option><option>Cheque</option><option>Store credit</option><option>Other</option>
                </select>
              </div>
              {method === 'Store credit' && (
                <div className="consignment-store-credit-note">
                  <CircleDollarSign size={17} />
                  <span>This records the amount as store credit in the payout ledger and on each linked Shopify product.</span>
                </div>
              )}
              <div className="consignment-payout-fields">
                <div className="consignment-field">
                  <label className="consignment-label">Payout date</label>
                  <input className="consignment-input" type="date" value={payoutDate} onChange={(event) => setPayoutDate(event.target.value)} />
                </div>
                <div className="consignment-field">
                  <label className="consignment-label">Reference</label>
                  <input
                    className="consignment-input"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder={method === 'Store credit' ? 'Credit memo or note' : 'Optional confirmation #'}
                  />
                </div>
              </div>
              <label className="consignment-label">Payout note</label>
              <textarea className="consignment-textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional payment reference or note" />
            </div>
            <button
              type="button"
              className="consignment-btn"
              disabled={!selected.length || saving}
              onClick={async () => {
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
              }}
            >
              <WalletCards size={17} /> Record payout
            </button>
          </aside>
        </div>
      </div>
    </>
  );
}

/* ---------- screens ---------- */

function HomeScreen({ consignors, items, query, setQuery, onOpenConsignor, onOpenItem, onMarkSold, onNewConsignor, onNewItem, onImport, onExport }) {
  const [filter, setFilter] = useState('All');
  const [consignorFilter, setConsignorFilter] = useState('All');
  const [productFilter, setProductFilter] = useState('All');
  const [sort, setSort] = useState('consignor');
  const [viewMode, setViewMode] = useState('grouped');
  const [sellingItemId, setSellingItemId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const statuses = ['All', 'Draft', 'Available', 'Sold', 'Archived', 'Returned', 'Donated'];
  const consignorById = Object.fromEntries(consignors.map((entry) => [entry.id, entry]));

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const consignor = consignorById[item.consignorId];
    const matchesQuery = !q || `${item.description} ${item.itemNumber} ${item.type} ${item.brand || ''} ${consignor?.firstName || ''} ${consignor?.lastName || ''} ${consignor?.number || ''}`.toLowerCase().includes(q);
    const matchesConsignor = consignorFilter === 'All' || item.consignorId === consignorFilter;
    const product = productLabel(item);
    const matchesProduct = productFilter === 'All'
      || (productFilter === 'Manual' && product.className === 'manual')
      || (productFilter === 'POS' && product.text === 'POS')
      || (productFilter === 'Online' && product.text === 'Online')
      || (productFilter === 'POS + Online' && product.text === 'POS + Online');
    const matchesStatus = filter === 'All'
      ? true
      : filter === 'Archived'
        ? item.paidOut
        : filter === 'Available'
          ? item.status === 'Available' || item.status === 'Active'
          : item.status === filter && !item.paidOut;
    return matchesQuery && matchesConsignor && matchesProduct && matchesStatus;
  }).sort((a, b) => {
    if (sort === 'oldest') return String(a.dateReceived || '').localeCompare(String(b.dateReceived || ''));
    if (sort === 'consignor') {
      const aName = `${consignorById[a.consignorId]?.lastName || ''} ${consignorById[a.consignorId]?.firstName || ''}`;
      const bName = `${consignorById[b.consignorId]?.lastName || ''} ${consignorById[b.consignorId]?.firstName || ''}`;
      return aName.localeCompare(bName) || a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true });
    }
    if (sort === 'ticket') return a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true });
    if (sort === 'priceHigh') return Number(b.price || 0) - Number(a.price || 0);
    if (sort === 'priceLow') return Number(a.price || 0) - Number(b.price || 0);
    return String(b.dateReceived || '').localeCompare(String(a.dateReceived || '')) || b.itemNumber.localeCompare(a.itemNumber, undefined, { numeric: true });
  });

  const grouped = filtered.reduce((groups, item) => {
    const key = item.consignorId || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());

  // Also surface consignors with zero items, so a newly created consignor
  // doesn't disappear from this screen just because nothing's been
  // consigned yet. Only when the item-specific filters are at their
  // default — a consignor with no items can never truthfully match a
  // status or product-type filter other than "All".
  if (filter === 'All' && productFilter === 'All') {
    const q = query.trim().toLowerCase();
    for (const consignor of consignors) {
      if (grouped.has(consignor.id)) continue;
      if (consignorFilter !== 'All' && consignor.id !== consignorFilter) continue;
      const matchesQuery = !q || `${consignor.firstName || ''} ${consignor.lastName || ''} ${consignor.number || ''}`.toLowerCase().includes(q);
      if (!matchesQuery) continue;
      grouped.set(consignor.id, []);
    }
  }

  const groupedEntries = Array.from(grouped.entries()).sort(([aId, aItems], [bId, bItems]) => {
    if (sort !== 'consignor') return filtered.indexOf(aItems[0]) - filtered.indexOf(bItems[0]);
    const a = consignorById[aId];
    const b = consignorById[bId];
    return `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`);
  });

  async function quickMarkSold(item) {
    if (sellingItemId) return;
    const amount = window.prompt(`Sale price for ${item.description || item.itemNumber}`, String(item.price ?? ''));
    if (amount === null) return;
    const salePrice = Number(amount);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      window.alert('Enter a valid sale price.');
      return;
    }
    setSellingItemId(item.id);
    try {
      await onMarkSold(item.id, { salePrice, dateSold: new Date().toISOString().slice(0, 10) });
    } finally {
      setSellingItemId(null);
    }
  }

  function toggleGroup(consignorId) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(consignorId)) next.delete(consignorId);
      else next.add(consignorId);
      return next;
    });
  }

  function ConsignorName({ consignor }) {
    if (!consignor) return <span>Unassigned</span>;
    return (
      <button type="button" className="consignment-consignor-profile-link" onClick={() => onOpenConsignor(consignor.id)}>
        {consignor.firstName} {consignor.lastName}
      </button>
    );
  }

  function ItemAction({ item, product, compact = false }) {
    const isManualAvailable = product.className === 'manual' && (item.status === 'Available' || item.status === 'Active') && !item.paidOut;
    if (isManualAvailable) {
      return (
        <button type="button" className="consignment-quick-sold-btn" disabled={sellingItemId === item.id} onClick={() => quickMarkSold(item)}>
          {sellingItemId === item.id ? 'Saving…' : 'Mark sold'}
        </button>
      );
    }
    return (
      <button type="button" className={compact ? 'consignment-grid-open-btn' : 'consignment-item-open-btn'} onClick={() => onOpenItem(item.id)}>
        Open item
      </button>
    );
  }

  return (
    <>
      <Header
        eyebrow="Accounts"
        title="Consignors"
        action={(
          <div className="consignment-header-actions">
            <details className="consignment-data-menu">
              <summary><FileUp size={16} /> Data</summary>
              <div className="consignment-data-menu-popover">
                <button type="button" onClick={onImport}><FileUp size={15} /> Import CSV</button>
                <button type="button" onClick={onExport}><Download size={15} /> Export CSV</button>
              </div>
            </details>
            <button className="consignment-btn secondary" type="button" onClick={onNewItem}><Plus size={16} /> New item</button>
            <button className="consignment-btn" type="button" onClick={onNewConsignor}><Plus size={17} /> New consignor</button>
          </div>
        )}
      />
      <div className="consignment-body">
        <div className="consignment-items-toolbar">
          <details className="consignment-items-filter-details">
            <summary className="consignment-items-filter-summary">
              <span>Filters &amp; sorting</span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <div className="consignment-items-toolbar-top">
            <label className="consignment-tool-field"><span>Consignor</span><select className="consignment-select consignment-filter-select" value={consignorFilter} onChange={(event) => setConsignorFilter(event.target.value)} aria-label="Filter by consignor">
              <option value="All">All consignors</option>
              {consignors.map((consignor) => <option key={consignor.id} value={consignor.id}>#{consignor.number} · {consignor.firstName} {consignor.lastName}</option>)}
            </select></label>
            <label className="consignment-tool-field"><span>Sort</span><select className="consignment-select consignment-filter-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort items">
              <option value="consignor">Consignor name</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">SKU / item number</option><option value="priceHigh">Price high to low</option><option value="priceLow">Price low to high</option>
            </select></label>
            <label className="consignment-tool-field"><span>Product type</span><select className="consignment-select consignment-filter-select" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} aria-label="Filter by product type">
              <option value="All">All product types</option><option value="Manual">Manual</option><option value="POS">POS</option><option value="Online">Online</option><option value="POS + Online">POS + Online</option>
            </select></label>
            <label className="consignment-tool-field"><span>Status</span><select id="consignor-status-filter" className="consignment-select consignment-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {statuses.map((status) => {
                const count = status === 'All' ? items.length : status === 'Archived' ? items.filter((item) => item.paidOut).length : items.filter((item) => item.status === status && !item.paidOut).length;
                return <option key={status} value={status}>{statusLabel(status)} ({count})</option>;
              })}
            </select></label>
            </div>
          </details>
          <div className="consignment-items-toolbar-bottom">
            <div className="consignment-search">
              <Search size={19} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, brand, or consignor" />
            </div>
            <div className="consignment-tool-view"><span>View</span><div className="consignment-view-toggle consignment-finder-toggle" aria-label="Choose consignor view">
              <button type="button" className={viewMode === 'grouped' ? 'active' : ''} onClick={() => setViewMode('grouped')} aria-pressed={viewMode === 'grouped'}><Users size={16} /> By consignor</button>
              <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}><Grid3X3 size={16} /> Grid</button>
            </div></div>
          </div>
        </div>

        {groupedEntries.length === 0 && <section className="consignment-card"><div className="consignment-empty-small">No consignors match these filters.</div></section>}

        {viewMode === 'grouped' && (
          <div className="consignment-item-groups">
            {groupedEntries.map(([consignorId, consignorItems]) => {
              const consignor = consignorById[consignorId];
              const availableCount = consignorItems.filter((item) => item.status === 'Available' || item.status === 'Active').length;
              const soldCount = consignorItems.filter((item) => item.status === 'Sold' || item.dateSold).length;
              const initials = consignor ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` : '—';
              const collapsed = collapsedGroups.has(consignorId);
              return (
                <section className="consignment-item-group" key={consignorId}>
                  <div className="consignment-item-group-summary">
                    <button type="button" className={`consignment-item-group-chevron ${collapsed ? '' : 'open'}`} onClick={() => toggleGroup(consignorId)} aria-label={collapsed ? 'Expand consignor items' : 'Collapse consignor items'}><ChevronRight size={16} /></button>
                    <span className="consignment-avatar consignment-item-group-avatar">{initials}</span>
                    <span className="consignment-item-group-person">
                      <ConsignorName consignor={consignor} />
                      <span className="consignment-item-group-meta"><strong className="consignment-item-group-number">#{consignor?.number || '—'}</strong><span className="consignment-item-group-count">· {consignorItems.length} item{consignorItems.length === 1 ? '' : 's'}</span></span>
                    </span>
                    <span className="consignment-item-group-stat"><strong>{availableCount}</strong><span>Available</span></span>
                    <span className="consignment-item-group-stat"><strong>{soldCount}</strong><span>Sold</span></span>
                  </div>
                  {!collapsed && (
                    <div className="consignment-item-group-items">
                      <div className="consignment-grouped-item-row consignment-list-head"><span>Item</span><span>Price</span><span>Commission</span><span>Product</span><span>Status</span><span>Action</span></div>
                      {consignorItems.map((item) => {
                        const product = productLabel(item);
                        return (
                          <div className="consignment-grouped-item-row" key={item.id}>
                            <button type="button" className="consignment-grouped-item-open" onClick={() => onOpenItem(item.id)}><span className="consignment-batch-thumb">{item.photo ? <img src={item.photo} alt="" /> : <Tag size={16} color="var(--green-dark)" />}</span><span><strong>{item.description || item.type || 'Consignment item'}</strong><span>{item.itemNumber}{item.size ? ` · ${item.size}` : ''}{item.brand ? ` · ${item.brand}` : ''}</span></span></button>
                            <strong>{money(item.price)}</strong><span>{item.commissionPct}%</span><span className={`consignment-product-badge ${product.className}`}>{product.text}</span><span className={`consignment-badge ${item.paidOut ? 'sold' : statusClass(item.status)}`}>{item.paidOut ? 'Paid · archived' : statusLabel(item.status)}</span><span className="consignment-item-quick-action"><ItemAction item={item} product={product} /></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="consignment-consignor-card-grid">
            {groupedEntries.map(([consignorId, consignorItems]) => {
              const consignor = consignorById[consignorId];
              const initials = consignor ? `${consignor.firstName?.[0] || ''}${consignor.lastName?.[0] || ''}` : '—';
              const availableCount = consignorItems.filter((item) => item.status === 'Available' || item.status === 'Active').length;
              const soldCount = consignorItems.filter((item) => item.status === 'Sold' || item.dateSold).length;
              const due = consignorItems
                .filter((item) => (item.status === 'Sold' || item.dateSold) && !item.paidOut)
                .reduce((sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor?.commissionPct ?? 0)) / 100, 0);
              return (
                <article className="consignment-consignor-card" key={consignorId}>
                  <div className="consignment-consignor-card-top">
                    <span className="consignment-avatar">{initials}</span>
                    <span className="consignment-consignor-card-name">
                      <strong>{consignor ? `${consignor.firstName} ${consignor.lastName}` : 'Unassigned'}</strong>
                      <small>#{consignor?.number || '—'}</small>
                    </span>
                  </div>
                  <div className="consignment-consignor-card-stats">
                    <span><strong>{availableCount}</strong><small>Active</small></span>
                    <span><strong>{soldCount}</strong><small>Sold</small></span>
                  </div>
                  <div className="consignment-consignor-card-due"><small>Amount due</small><strong>{money(due)}</strong></div>
                  <button type="button" className="consignment-consignor-card-open" onClick={() => onOpenConsignor(consignorId)}>View consignor</button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ChooseConsignorScreen({ consignors, onBack, onChoose, onCreate }) {
  const [search, setSearch] = useState('');
  const filtered = consignors.filter((consignor) => {
    const query = search.trim().toLowerCase();
    return !query || `${consignor.firstName} ${consignor.lastName} ${consignor.number}`
      .toLowerCase()
      .includes(query);
  });

  return (
    <>
      <Header eyebrow="New item" title="Choose consignor" onBack={onBack} />
      <div className="consignment-body">
        <button type="button" className="consignment-quick-action primary" onClick={onCreate} style={{ width: '100%', marginBottom: 14 }}>
          <span className="consignment-quick-action-icon"><Plus size={19} /></span>
          <span className="consignment-quick-action-copy">
            <strong>Create new consignor</strong>
            <span>Add their details, then continue directly to the item</span>
          </span>
        </button>

        <div className="consignment-search">
          <Search size={17} />
          <input
            placeholder="Search name or consignor number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {filtered.map((consignor) => (
          <button
            key={consignor.id}
            type="button"
            className="consignment-row-btn"
            onClick={() => onChoose(consignor.id)}
          >
            <div className="consignment-avatar">{consignor.firstName?.[0]}{consignor.lastName?.[0]}</div>
            <div className="consignment-row-main">
              <div className="consignment-row-name">{consignor.firstName} {consignor.lastName}</div>
              <div className="consignment-row-sub">Consignor #{consignor.number}</div>
            </div>
            <ChevronRight size={18} className="consignment-chev" />
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="consignment-empty">
            <h3>No matching consignor</h3>
            <p>Create a new consignor to continue.</p>
          </div>
        )}
      </div>
    </>
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim()); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one data row.');
  const headers = rows[0].map((value) => value.toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function csvValue(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(fileName, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvValue).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function exportConsignors(consignors) {
  const headers = ['number', 'first_name', 'last_name', 'phone', 'email', 'address', 'city', 'province', 'postal_code', 'date_joined', 'commission_pct', 'unsold_preference', 'notes'];
  const rows = consignors.map((c) => [
    c.number, c.firstName, c.lastName, c.phone, c.email, c.address, c.city,
    c.province, c.postalCode, c.dateJoined, c.commissionPct, c.unsoldPreference, c.notes,
  ]);
  downloadCsv(`consignors-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

function exportItems(items, consignors) {
  const consignorById = Object.fromEntries(consignors.map((c) => [c.id, c]));
  const headers = [
    'item_number', 'consignor_number', 'description', 'price', 'category', 'type',
    'size', 'condition', 'status', 'date_received', 'commission_pct', 'notes',
    'tags', 'brand', 'vendor', 'product_description', 'sale_price', 'date_sold',
    'order_name', 'order_id', 'paid_out', 'payout_id', 'payout_date',
    'payout_method', 'payout_reference', 'payout_note', 'payout_amount',
    'payout_total', 'payout_adjustment', 'shopify_product_id',
  ];
  const rows = items.map((item) => [
    item.itemNumber, consignorById[item.consignorId]?.number || '', item.description,
    item.price, item.category, item.type, item.size, item.condition, item.status,
    item.dateReceived, item.commissionPct, item.notes,
    Array.isArray(item.tags) ? item.tags.join('|') : item.tags || '',
    item.brand, item.vendor, item.productDescription, item.salePrice, item.dateSold,
    item.orderName, item.orderId, item.paidOut ? 'true' : 'false', item.payoutId,
    item.payoutDate, item.payoutMethod, item.payoutReference, item.payoutNote,
    item.payoutAmount, item.payoutTotal, item.payoutAdjustment, item.shopifyProductId,
  ]);
  downloadCsv(`items-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

function ImportScreen({ kind, onBack, onImport, fixedConsignor = null }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [localError, setLocalError] = useState('');
  const [saving, setSaving] = useState(false);
  const isConsignors = kind === 'consignors';
  const required = isConsignors
    ? 'consignor_import_key, first_name, last_name; item_description and price when the row contains an item'
    : fixedConsignor ? 'item_description, price' : 'consignor_import_key (or email/phone), item_description, price';
  const templateConsignorNumber = fixedConsignor?.number || 1;
  const itemColumns = 'item_import_key,item_description,price,category,item_type,brand,size,condition,item_notes,status,date_received,consignment_term,expiry_action,create_shopify_product,shopify_title,shopify_price,shopify_description,shopify_vendor,shopify_tags,publish_to_pos,publish_online,seo_title,seo_description,sale_price,sale_date,payout_status';
  const template = isConsignors
    ? `consignor_import_key,first_name,last_name,phone,email,address,city,province,postal_code,date_joined,commission_pct,unsold_preference,consignor_notes,${itemColumns}\njane-smith-9055550100,Jane,Smith,905-555-0100,jane@example.com,123 Main Street,Hamilton,Ontario,L8E 1A1,2026-07-30,50,Please return,,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`
    : fixedConsignor
      ? `${itemColumns},consignor_number\nitem-001,Blue baby sweater,18.00,Clothing,Sweater,Gap,12M,Good,,Available,2026-07-30,60,Please return,true,Blue baby sweater,18.00,Soft blue baby sweater,Gap,baby|sweater,true,false,Blue baby sweater,Soft blue baby sweater,,,${templateConsignorNumber}`
      : `consignor_import_key,email,phone,${itemColumns}\njane-smith-9055550100,jane@example.com,905-555-0100,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`;

  function downloadTemplate() {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${kind}-import-template.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      let parsed = parseCsv(await file.text());
      if (!isConsignors && fixedConsignor) {
        parsed = parsed.map((row, index) => {
          return { ...row, consignor_number: fixedConsignor.number };
        });
      }
      setRows(parsed); setFileName(file.name); setLocalError('');
    } catch (error) { setRows([]); setFileName(file.name); setLocalError(error.message); }
  }

  return (
    <>
      <Header eyebrow="Data import" title={isConsignors ? 'Import consignors and items' : fixedConsignor ? `Import items for ${fixedConsignor.firstName} ${fixedConsignor.lastName}` : 'Import items'} onBack={onBack} />
      <div className="consignment-body">
        <div className="consignment-card">
          <strong style={{ fontSize: 14 }}>Start with the template</strong>
          <p className="consignment-import-help">Required columns: {required}. The app assigns consignor and item numbers automatically. Keep the headings unchanged, fill in your rows, then save as CSV.{fixedConsignor && !isConsignors ? ` Every row will be assigned to consignor #${fixedConsignor.number}.` : ''}</p>
          <button className="consignment-btn secondary" onClick={downloadTemplate}><Download size={16} /> Download template</button>
        </div>
        <div className="consignment-import-drop">
          <label>
            <FileUp size={24} />
            <span>{fileName || 'Choose CSV file'}</span>
            <input type="file" accept=".csv,text/csv" onChange={chooseFile} />
          </label>
          <div className="consignment-import-help">Nothing is imported until you review the count and press Import.</div>
        </div>
        {localError && <div className="consignment-card" style={{ color: 'var(--danger)' }}>{localError}</div>}
        {rows.length > 0 && (
          <>
            <div className="consignment-import-preview">
              <div><span>File</span><strong style={{ fontSize: 12 }}>{fileName}</strong></div>
              <div><span>Rows ready</span><strong>{rows.length}</strong></div>
              <div><span>Importing</span><strong style={{ fontSize: 13 }}>{isConsignors ? 'Consignors + items · Shopify supported' : 'Items · Shopify supported'}</strong></div>
            </div>
            <div className="consignment-import-actions">
              <button className="consignment-btn" disabled={saving} onClick={async () => {
                setSaving(true);
                try { await onImport(kind, rows); } finally { setSaving(false); }
              }}>{saving ? <Loader2 className="consignment-spin" size={16} /> : <FileUp size={16} />} Import {rows.length} row{rows.length === 1 ? '' : 's'}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function NewConsignorScreen({ onBack, onSave, nextNumber }) {
  const [form, setForm] = useState({ number: nextNumber, firstName: '', lastName: '', phone: '', email: '', address: '', city: '', province: 'Ontario', postalCode: '', commissionPct: 50, unsoldPreference: 'Please return', notes: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.firstName.trim() && form.lastName.trim();

  return (
    <>
      <Header eyebrow="New" title="Add consignor" onBack={onBack} />
      <div className="consignment-body">
        <div className="consignment-field">
          <label className="consignment-label">Consignor number</label>
          <input className="consignment-input" type="number" inputMode="numeric" min="1" step="1" value={form.number} onChange={set('number')} />
          <div className="consignment-row-sub" style={{ marginTop: 6 }}>Automatically assigned, but you can change it.</div>
        </div>
        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">First name</label>
            <input className="consignment-input" value={form.firstName} onChange={set('firstName')} placeholder="Sarah" />
          </div>
          <div className="consignment-field">
            <label className="consignment-label">Last name</label>
            <input className="consignment-input" value={form.lastName} onChange={set('lastName')} placeholder="Lee" />
          </div>
        </div>
        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">Phone</label>
            <input className="consignment-input" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(416) 555-0134" />
          </div>
          <div className="consignment-field">
            <label className="consignment-label">Email</label>
            <input className="consignment-input" type="email" value={form.email} onChange={set('email')} placeholder="sarah@email.com" />
          </div>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Street address</label>
          <input className="consignment-input" value={form.address} onChange={set('address')} placeholder="123 Main Street" autoComplete="street-address" />
        </div>
        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">City</label>
            <input className="consignment-input" value={form.city} onChange={set('city')} placeholder="Hamilton" autoComplete="address-level2" />
          </div>
          <div className="consignment-field">
            <label className="consignment-label">Province</label>
            <input className="consignment-input" value={form.province} onChange={set('province')} placeholder="Ontario" autoComplete="address-level1" />
          </div>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Postal code</label>
          <input className="consignment-input" value={form.postalCode} onChange={set('postalCode')} placeholder="L8E 1A1" autoCapitalize="characters" autoComplete="postal-code" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Commission split &mdash; consignor gets</label>
          <input className="consignment-input" type="number" inputMode="decimal" value={form.commissionPct} onChange={set('commissionPct')} placeholder="50" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Unsold items</label>
          <select className="consignment-select" value={form.unsoldPreference} onChange={set('unsoldPreference')}>
            <option value="Please return">Please return</option>
            <option value="Donation okay">Donation okay</option>
            <option value="Ask me first">Ask me first</option>
          </select>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Notes (optional)</label>
          <textarea className="consignment-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering" />
        </div>
      </div>
      <div className="consignment-fab-wrap">
        <button className="consignment-btn" disabled={!valid} onClick={() => onSave(form)}>
          <Check size={18} /> Save consignor
        </button>
      </div>
    </>
  );
}

function EditConsignorScreen({ consignor, onBack, onSave }) {
  const [form, setForm] = useState({
    number: consignor.number,
    firstName: consignor.firstName || '',
    lastName: consignor.lastName || '',
    phone: consignor.phone || '',
    email: consignor.email || '',
    address: consignor.address || '',
    city: consignor.city || '',
    province: consignor.province || 'Ontario',
    postalCode: consignor.postalCode || '',
    commissionPct: consignor.commissionPct ?? 50,
    unsoldPreference: consignor.unsoldPreference || 'Please return',
    notes: consignor.notes || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.firstName.trim() && form.lastName.trim();

  return (
    <>
      <Header eyebrow={`Consignor #${consignor.number}`} title="Edit consignor" onBack={onBack} />
      <div className="consignment-body">
        <div className="consignment-field">
          <label className="consignment-label">Consignor number</label>
          <input className="consignment-input" type="number" inputMode="numeric" min="1" step="1" value={form.number} onChange={set('number')} />
        </div>
        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">First name</label>
            <input className="consignment-input" value={form.firstName} onChange={set('firstName')} placeholder="Sarah" />
          </div>
          <div className="consignment-field">
            <label className="consignment-label">Last name</label>
            <input className="consignment-input" value={form.lastName} onChange={set('lastName')} placeholder="Lee" />
          </div>
        </div>
        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">Phone</label>
            <input className="consignment-input" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(416) 555-0134" />
          </div>
          <div className="consignment-field">
            <label className="consignment-label">Email</label>
            <input className="consignment-input" type="email" value={form.email} onChange={set('email')} placeholder="sarah@email.com" />
          </div>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Street address</label>
          <input className="consignment-input" value={form.address} onChange={set('address')} placeholder="123 Main Street" autoComplete="street-address" />
        </div>
        <div className="consignment-row2">
          <div className="consignment-field">
            <label className="consignment-label">City</label>
            <input className="consignment-input" value={form.city} onChange={set('city')} placeholder="Hamilton" autoComplete="address-level2" />
          </div>
          <div className="consignment-field">
            <label className="consignment-label">Province</label>
            <input className="consignment-input" value={form.province} onChange={set('province')} placeholder="Ontario" autoComplete="address-level1" />
          </div>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Postal code</label>
          <input className="consignment-input" value={form.postalCode} onChange={set('postalCode')} placeholder="L8E 1A1" autoCapitalize="characters" autoComplete="postal-code" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Commission split &mdash; consignor gets</label>
          <input className="consignment-input" type="number" inputMode="decimal" value={form.commissionPct} onChange={set('commissionPct')} placeholder="50" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Unsold items</label>
          <select className="consignment-select" value={form.unsoldPreference} onChange={set('unsoldPreference')}>
            <option value="Please return">Please return</option>
            <option value="Donation okay">Donation okay</option>
            <option value="Ask me first">Ask me first</option>
          </select>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Notes (optional)</label>
          <textarea className="consignment-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering" />
        </div>
      </div>
      <div className="consignment-fab-wrap">
        <button className="consignment-btn" disabled={!valid} onClick={() => onSave(consignor.id, form)}>
          <Check size={18} /> Save changes
        </button>
      </div>
    </>
  );
}

function ConsignorScreen({ consignor, items, onBack, onStartIntake, onOpenItem, onDeleteConsignor, onEditConsignor, onStartPayout }) {
  const [viewMode, setViewMode] = useState('grid');
  const consignorItems = items.filter((item) => item.consignorId === consignor.id);
  const draftCount = consignorItems.filter((item) => item.status === 'Draft').length;
  const soldItems = consignorItems.filter((item) => item.status === 'Sold' || item.dateSold);
  const unpaidItems = soldItems.filter((item) => !item.paidOut);
  const totalSales = soldItems.reduce((sum, item) => sum + Number(item.salePrice ?? item.price ?? 0), 0);
  const activeCount = consignorItems.filter((item) => ['Available', 'Active'].includes(item.status)).length;
  const [confirmingDeleteConsignor, setConfirmingDeleteConsignor] = useState(false);
  const amountDue = unpaidItems.reduce(
    (sum, item) => sum + (Number(item.salePrice ?? item.price ?? 0) * Number(item.commissionPct ?? consignor.commissionPct ?? 0)) / 100,
    0,
  );
  const fullAddress = [consignor.address, consignor.city, consignor.province, consignor.postalCode]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Header
        eyebrow={`Consignor #${consignor.number}`}
        title={`${consignor.firstName} ${consignor.lastName}`}
        onBack={onBack}
        action={(
          <div className="consignment-header-actions">
            <button className="consignment-btn" onClick={onStartIntake}>
              <Plus size={17} /> Add items
            </button>
            <button className="consignment-btn secondary" onClick={onEditConsignor}>
              <Pencil size={17} /> Edit
            </button>
            <button
              className="consignment-btn secondary"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger-soft)' }}
              onClick={() => setConfirmingDeleteConsignor(true)}
            >
              <Trash2 size={17} /> Delete
            </button>
          </div>
        )}
      />
      <div className="consignment-body">
        <section className="consignment-card consignment-consignor-profile" aria-label="Consignor profile information">
          <div className="consignment-profile-column">
            <div className="consignment-profile-title">Contact</div>
            <div className="consignment-profile-row">
              <span className="consignment-profile-icon"><Phone size={17} /></span>
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">Phone</span>
                {consignor.phone ? <a className="consignment-profile-value consignment-profile-link" href={`tel:${String(consignor.phone).replace(/[^\d+]/g, '')}`}>{consignor.phone}</a> : <span className="consignment-profile-value">—</span>}
              </span>
            </div>
            <div className="consignment-profile-row">
              <span className="consignment-profile-icon"><Mail size={17} /></span>
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">Email</span>
                {consignor.email ? <a className="consignment-profile-value consignment-profile-link" href={`mailto:${consignor.email}`}>{consignor.email}</a> : <span className="consignment-profile-value">—</span>}
              </span>
            </div>
            <div className="consignment-profile-row">
              <span className="consignment-profile-icon"><MapPin size={17} /></span>
              <span className="consignment-profile-copy">
                <span className="consignment-profile-label">Address</span>
                {fullAddress ? <a className="consignment-profile-value consignment-profile-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">{fullAddress}</a> : <span className="consignment-profile-value">—</span>}
              </span>
            </div>
          </div>
          <div className="consignment-profile-column">
            <div className="consignment-profile-title">Account details</div>
            <div className="consignment-profile-row detail"><span className="consignment-profile-copy"><span className="consignment-profile-label">Commission split</span><span className="consignment-profile-value">Consignor gets {consignor.commissionPct}%</span></span></div>
            <div className="consignment-profile-row detail"><span className="consignment-profile-copy"><span className="consignment-profile-label">Joined</span><span className="consignment-profile-value">{consignor.dateJoined || '—'}</span></span></div>
            <div className="consignment-profile-row detail"><span className="consignment-profile-copy"><span className="consignment-profile-label">Unsold items</span><span className="consignment-profile-value">{consignor.unsoldPreference || 'Please return'}</span></span></div>
          </div>
        </section>

        <div className="consignment-consignor-stats">
          <div className="consignment-consignor-stat"><span>Amount due</span><strong>{money(amountDue)}</strong></div>
          <div className="consignment-consignor-stat"><span>Total sales</span><strong>{money(totalSales)}</strong></div>
          <div className="consignment-consignor-stat"><span>Active items</span><strong>{activeCount}</strong></div>
          <div className="consignment-consignor-stat"><span>Store credit</span><strong aria-label="Not available yet">&nbsp;</strong></div>
        </div>

        <div className="consignment-consignor-items-head">
          <h3>Items on file</h3>
          <div className="consignment-consignor-items-tools">
            <span className="consignment-consignor-items-count">{consignorItems.length} total · {draftCount} draft</span>
            <div className="consignment-consignor-view-toggle" aria-label="Choose item view">
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><List size={14} /> List</button>
              <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}><Grid3X3 size={14} /> Grid</button>
            </div>
          </div>
        </div>

        {consignorItems.length === 0 && (
          <div className="consignment-empty">
            <h3>No items yet</h3>
            <p>Add what they brought in today.</p>
          </div>
        )}

        <div className={`consignment-consignor-item-list ${viewMode === 'grid' ? 'grid' : ''}`}>
          {consignorItems.map((item) => {
            const product = productLabel(item);
            const saleSource = saleSourceLabel(item);
            const soldUnpaid = (item.status === 'Sold' || item.dateSold) && !item.paidOut;
            return (
              <article key={item.id} className="consignment-card consignment-consignor-item">
                <button type="button" className="consignment-consignor-item-open" onClick={() => onOpenItem(item.id)}>
                  <span className="consignment-batch-thumb" style={{ width: 48, height: 48, borderRadius: 10 }}>
                    {item.photo ? <img src={item.photo} alt="" /> : <Tag size={18} color="var(--green-dark)" />}
                  </span>
                  <span className="consignment-consignor-item-copy">
                    <span className="consignment-consignor-item-title">{item.description || item.category}</span>
                    <span className="consignment-consignor-item-meta">{item.itemNumber} · {item.size ? `Size ${item.size} · ` : ''}{money(item.price)}</span>
                    <span className="consignment-consignor-item-meta">Product type: {item.type || item.category || 'Not set'}</span>
                    {item.paidOut && <span className="consignment-paid-detail">Paid {item.payoutDate || ''} · {item.payoutMethod || 'Method not recorded'} · {money(item.payoutAmount)}</span>}
                  </span>
                </button>
                <div className="consignment-consignor-item-actions">
                  <span className={`consignment-product-badge ${(saleSource || product).className}`}>
                    {(saleSource || product).text}
                  </span>
                  <span className={`consignment-badge ${item.paidOut ? 'paid' : item.status === 'Sold' ? 'unpaid' : statusClass(item.status)}`}>
                    {item.paidOut ? 'Paid' : item.status === 'Sold' ? 'Sold · unpaid' : statusLabel(item.status)}
                  </span>
                  {soldUnpaid ? (
                    <button type="button" className="consignment-consignor-pay-btn" onClick={() => onStartPayout(consignor.id)}>Review &amp; pay</button>
                  ) : <span className="consignment-consignor-action-spacer" aria-hidden="true" />}
                </div>
              </article>
            );
          })}
        </div>

        {confirmingDeleteConsignor && (
          <div className="consignment-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>Delete {consignor.firstName} {consignor.lastName} for good?</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="consignment-btn secondary" style={{ padding: '8px 14px' }} onClick={() => setConfirmingDeleteConsignor(false)}>Cancel</button>
              <button className="consignment-btn danger" style={{ padding: '8px 14px' }} onClick={() => onDeleteConsignor(consignor.id)}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


function ConsignmentItemFields({ form, setForm }) {
  const set = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.value,
  }));

  function setCategory(category) {
    setForm((current) => ({
      ...current,
      category,
      type: '',
    }));
  }

  return (
    <div className="consignment-card consignment-detail-card">
      <div className="consignment-section-heading">
        <label className="consignment-label">Consignment item information</label>
        <span className="consignment-row-sub">Manual metaobject record</span>
      </div>
      <div className="consignment-detail-grid">
        <div className="consignment-field">
          <label className="consignment-label">Category</label>
          <select className="consignment-select" value={form.category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Brand</label>
          <input className="consignment-input" value={form.brand} onChange={set('brand')} placeholder="e.g. Gap" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Size</label>
          <input className="consignment-input" value={form.size} onChange={set('size')} placeholder="Optional" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Condition</label>
          <select className="consignment-select" value={form.condition} onChange={set('condition')}>
            {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </div>
        <div className="consignment-field wide">
          <label className="consignment-label">Internal notes</label>
          <textarea className="consignment-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Notes about this consigned item" />
        </div>
      </div>
    </div>
  );
}

function ShopifyProductFields({ form, setForm }) {
  const [categorySearch, setCategorySearch] = useState(form.shopifyCategoryName || '');
  const [categoryResults, setCategoryResults] = useState([]);
  const [searchingCategories, setSearchingCategories] = useState(false);

  useEffect(() => {
    const query = categorySearch.trim();
    if (query.length < 2 || query === form.shopifyCategoryName) {
      setCategoryResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      setSearchingCategories(true);
      searchShopifyCategories(query)
        .then(setCategoryResults)
        .catch(() => setCategoryResults([]))
        .finally(() => setSearchingCategories(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [categorySearch, form.shopifyCategoryName]);

  const set = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.value,
  }));

  return (
    <div className="consignment-shopify-fields">
      <div className="consignment-detail-grid">
        <div className="consignment-field wide">
          <label className="consignment-label">Shopify title *</label>
          <input className="consignment-input" value={form.shopifyTitle || ''} onChange={set('shopifyTitle')} placeholder="Required Shopify product title" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Shopify price</label>
          <input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.shopifyPrice ?? ''} onChange={set('shopifyPrice')} placeholder="Defaults to the manual item price" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Vendor</label>
          <input className="consignment-input" value={form.vendor} onChange={set('vendor')} placeholder="Defaults to store name" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Tags</label>
          <input className="consignment-input" value={form.tags} onChange={set('tags')} placeholder="summer, baby" />
        </div>
        <div className="consignment-field wide">
          <label className="consignment-label">Shopify product category</label>
          <input
            className="consignment-input"
            value={categorySearch}
            onChange={(event) => {
              setCategorySearch(event.target.value);
              if (event.target.value !== form.shopifyCategoryName) {
                setForm((current) => ({ ...current, shopifyCategoryId: '', shopifyCategoryName: '' }));
              }
            }}
            placeholder="Search Shopify categories"
          />
          {searchingCategories && <div className="consignment-row-sub" style={{ marginTop: 6 }}>Searching Shopify…</div>}
          {categoryResults.length > 0 && (
            <div className="consignment-category-results">
              {categoryResults.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="consignment-category-result"
                  onClick={() => {
                    setForm((current) => ({
                      ...current,
                      shopifyCategoryId: category.id,
                      shopifyCategoryName: category.name,
                    }));
                    setCategorySearch(category.name);
                    setCategoryResults([]);
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
          {form.shopifyCategoryId && (
            <div className="consignment-selected-category">
              <span>{form.shopifyCategoryName}</span>
              <button
                type="button"
                className="consignment-batch-remove"
                aria-label="Remove Shopify category"
                onClick={() => {
                  setForm((current) => ({ ...current, shopifyCategoryId: '', shopifyCategoryName: '' }));
                  setCategorySearch('');
                }}
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
        <div className="consignment-field wide">
          <label className="consignment-label">Product description</label>
          <textarea className="consignment-textarea" rows={3} value={form.productDescription} onChange={set('productDescription')} placeholder="Shown to customers on Shopify" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">SEO title</label>
          <input className="consignment-input" value={form.seoTitle} onChange={set('seoTitle')} placeholder="Defaults to item title" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">SEO description</label>
          <textarea className="consignment-textarea" rows={2} value={form.seoDescription} onChange={set('seoDescription')} placeholder="Optional search description" />
        </div>
      </div>
    </div>
  );
}

function ManualItemCore({
  form,
  setForm,
  onSave,
  saveLabel = 'Save manual item',
  saveDisabled = false,
  helperText = 'Saves only the consignment metaobject record. No Shopify product is created.',
}) {
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setCategory = (category) => setForm((current) => ({ ...current, category, type: '' }));

  return (
    <div className="consignment-card">
      <div className="consignment-intake-primary-fields">
        <div className="consignment-field">
          <label className="consignment-label">Item description *</label>
          <input className="consignment-input" value={form.description} onChange={set('description')} placeholder="What is it?" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Price *</label>
          <input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" />
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--line)', margin: '18px 0' }} />

      <div className="consignment-section-heading">
        <label className="consignment-label">Consignment item information</label>
        <span className="consignment-row-sub">Manual metaobject record</span>
      </div>
      <div className="consignment-detail-grid">
        <div className="consignment-field">
          <label className="consignment-label">Category</label>
          <select className="consignment-select" value={form.category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Brand</label>
          <input className="consignment-input" value={form.brand} onChange={set('brand')} placeholder="e.g. Gap" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Size</label>
          <input className="consignment-input" value={form.size} onChange={set('size')} placeholder="Optional" />
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Condition</label>
          <select className="consignment-select" value={form.condition} onChange={set('condition')}>
            {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </div>
        <div className="consignment-field">
          <label className="consignment-label">Consignment term</label>
          <select className="consignment-select" value={form.consignmentTerm || ''} onChange={set('consignmentTerm')}>
            <option value="">No term</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div className="consignment-field wide">
          <label className="consignment-label">Internal notes</label>
          <textarea className="consignment-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Notes about this consigned item" />
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--line)', margin: '18px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ display: 'block', fontSize: 14 }}>Manual consignment record</strong>
          <span className="consignment-row-sub" style={{ display: 'block', marginTop: 3 }}>{helperText}</span>
        </div>
        <button className="consignment-btn" disabled={saveDisabled} onClick={onSave}>
          <Check size={18} /> {saveLabel}
        </button>
      </div>
    </div>
  );
}

function productAdminUrl(productId) {
  const numericId = String(productId || '').split('/').pop();
  return `shopify://admin/products/${numericId}`;
}

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
  return (
    <details className="consignment-card consignment-shopify-section" open={Boolean(linkedProductId)}>
      <summary className="consignment-shopify-summary">
        <span>
          <ShoppingBag size={17} />
          <strong>Shopify product</strong>
        </span>
        <span className="consignment-row-sub">
          {!tier2Enabled ? 'Requires Manual + Shopify Sync plan' : linkedProductId ? 'Connected' : 'Separate optional workflow'}
        </span>
      </summary>
      <div className="consignment-shopify-content">
        {!tier2Enabled && (
          <div className="consignment-shopify-upsell" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            marginBottom: 14, padding: '10px 12px', borderRadius: 8,
            background: 'var(--surface-muted, #f5f5f5)', border: '1px solid var(--border, #e2e2e2)',
          }}>
            <span style={{ fontSize: 13 }}>
              Creating and syncing Shopify products is part of the <strong>Manual + Shopify Sync</strong> plan.
            </span>
            <a className="consignment-btn" style={{ flexShrink: 0 }} href="/app/plans" target="_top">
              Upgrade plan
            </a>
          </div>
        )}
        <p className="consignment-shopify-help">
          This section only controls the linked Shopify product. Manual item saving never creates or updates a Shopify product.
        </p>
        <div className="consignment-shopify-photo-row">
          <PhotoPicker value={shopifyForm.photo} onChange={(value) => setShopifyForm((current) => ({ ...current, photo: value }))} />
          <ShopifyProductFields form={shopifyForm} setForm={setShopifyForm} />
        </div>
        <label className="consignment-product-choice">
          <input type="checkbox" checked={shopifyForm.publishToPos !== false} onChange={(event) => setShopifyForm((current) => ({ ...current, publishToPos: event.target.checked }))} />
          <span>
            <strong>Create Shopify product</strong>
            <span>Creates or updates an Active product with inventory of one and publishes it to Point of Sale.</span>
          </span>
        </label>
        <label className="consignment-product-choice online">
          <input type="checkbox" checked={shopifyForm.publishOnline === true} onChange={(event) => setShopifyForm((current) => ({ ...current, publishOnline: event.target.checked }))} />
          <span>
            <strong>Also publish to Online Store</strong>
            <span>Publishes the same synced product to the Online Store.</span>
          </span>
        </label>
        {linkedProductId && (
          <p style={{ margin: '12px 0 0', color: 'var(--green-dark)', fontSize: 12 }}>
            <Check size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Linked Shopify product · {linkedStatus || 'Connected'}
          </p>
        )}
        {!linkedProductId ? (
          <button className="consignment-btn" style={{ marginTop: 14 }} disabled={!canSync || disabled || syncing || shopifyForm.publishToPos === false || !String(shopifyForm.shopifyTitle || '').trim()} onClick={onSync}>
            {syncing ? <Loader2 className="consignment-spin" size={16} /> : <ShoppingBag size={16} />}
            Create Shopify product
          </button>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            <button className="consignment-btn" disabled={!canSync || disabled || syncing || shopifyForm.publishToPos === false || !String(shopifyForm.shopifyTitle || '').trim()} onClick={onSync}>
              {syncing ? <Loader2 className="consignment-spin" size={16} /> : <Check size={16} />}
              Update Shopify product
            </button>
            <a className="consignment-btn secondary" href={productAdminUrl(linkedProductId)} target="_top">
              <span aria-hidden="true">↗</span> Edit in Shopify
            </a>
          </div>
        )}
        {linkedProductId && (
          <div className="consignment-row-sub" style={{ marginTop: 8 }}>
            Changes made in Shopify are loaded back into this section whenever the app refreshes. Changes made here are sent to Shopify with “Update Shopify product”.
          </div>
        )}
        {tier2Enabled && !canSync && <div className="consignment-row-sub" style={{ marginTop: 8 }}>Fill in the item description and price above — the manual record saves automatically when you create the Shopify product here.</div>}
      </div>
    </details>
  );
}

function IntakeScreen({ consignor, items, onBack, onSaveBatch, onSaveAndSync, tier2Enabled = false }) {
  const emptyForm = {
    category: 'Clothing', type: '', description: '', size: '', condition: 'Good',
    price: '', brand: '', notes: '', consignmentTerm: '',
  };
  const emptyShopifyForm = {
    photo: null, shopifyTitle: '', shopifyPrice: '', tags: '', vendor: '', productDescription: '', shopifyCategoryId: '',
    shopifyCategoryName: '', seoTitle: '', seoDescription: '', publishToPos: true,
    publishOnline: false,
  };
  const [form, setForm] = useState(emptyForm);
  const [shopifyForm, setShopifyForm] = useState(emptyShopifyForm);
  const [batch, setBatch] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const canAdd = form.description.trim() && form.price !== '';
  const saveCount = batch.length + (canAdd ? 1 : 0);
  const savedSequence = items
    .filter((item) => item.consignorId === consignor.id && item.itemNumber.startsWith(`${consignor.number}-`))
    .reduce((max, item) => Math.max(max, Number(item.itemNumber.split('-').pop()) || 0), 0);
  const nextItemNumber = `${consignor.number}-${String(savedSequence + batch.length + 1).padStart(3, '0')}`;

  function addToBatch() {
    if (!canAdd) return;
    setBatch((current) => [...current, form]);
    setForm({ ...emptyForm, category: form.category, brand: form.brand });
  }

  return (
    <>
      <Header eyebrow={`For ${consignor.firstName} ${consignor.lastName} · #${consignor.number}`} title="Add items" onBack={onBack} />
      <div className="consignment-body">
        {batch.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <label className="consignment-label">Manual items ready to save ({batch.length})</label>
            {batch.map((entry, index) => (
              <div key={`${entry.description}-${index}`} className="consignment-batch-item">
                <div className="consignment-batch-thumb"><Tag size={16} color="var(--green-dark)" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{entry.category} · {money(entry.price)}</div>
                </div>
                <button className="consignment-batch-remove" onClick={() => setBatch((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="consignment-section-heading">
          <label className="consignment-label">{batch.length > 0 ? 'Next manual item' : 'Manual consignment item'}</label>
          <span className="consignment-item-number">{nextItemNumber}</span>
        </div>
        <ManualItemCore
          form={form}
          setForm={setForm}
          onSave={() => onSaveBatch(canAdd ? [...batch, form] : batch)}
          saveDisabled={saveCount === 0}
          saveLabel={saveCount === 1 ? 'Save manual item' : `Save ${saveCount} manual items`}
        />
        <button className="consignment-btn secondary consignment-add-another" disabled={!canAdd} onClick={addToBatch}>
          <Plus size={16} /> Add another manual item
        </button>
        <ShopifyProductSection
          shopifyForm={shopifyForm}
          setShopifyForm={setShopifyForm}
          tier2Enabled={tier2Enabled}
          syncing={syncing}
          onSync={canAdd ? async () => {
            setSyncing(true);
            try {
              // Creates the Shopify product independently of the manual
              // "Save manual item" button — clicking this saves the manual
              // consignment record (this item, plus anything already
              // queued in the batch) AND creates the Shopify product in
              // one action. You do not need to save manually first.
              await onSaveAndSync(form, batch, shopifyForm);
            } finally {
              setSyncing(false);
            }
          } : null}
        />
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
  tier2Enabled = false,
}) {
  const [form, setForm] = useState({
    category: item.category || 'Other', type: '', description: item.description || '',
    size: item.size || '', condition: item.condition || 'Good', price: item.price ?? '',
    brand: item.brand || '', notes: item.notes || '', consignmentTerm: item.consignmentTerm || '',
  });
  const [shopifyForm, setShopifyForm] = useState({
    photo: item.shopifyPhoto || item.photo || null,
    shopifyTitle: item.shopifyTitle || '',
    shopifyPrice: item.shopifyPrice ?? item.price ?? '',
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || ''),
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
  const [statusSaving, setStatusSaving] = useState(false);
  const [salePrice, setSalePrice] = useState(item.salePrice ?? item.price ?? '');
  const [dateSold] = useState(item.dateSold || new Date().toISOString().slice(0, 10));
  const isSold = item.status === 'Sold' || Boolean(item.dateSold);
  const isPaid = item.paidOut === true;
  const canSave = form.description.trim() && form.price !== '';

  return (
    <>
      <Header eyebrow={`Item ${item.itemNumber}`} title="Edit item" onBack={onBack} />
      <div className="consignment-body">
        <div className="consignment-section-heading">
          <label className="consignment-label">Manual consignment item</label>
          <span className="consignment-item-number">{item.itemNumber}</span>
        </div>
        <ManualItemCore
          form={form}
          setForm={setForm}
          onSave={() => onSave(item.id, form)}
          saveDisabled={!canSave || isSold}
          saveLabel="Save manual changes"
          helperText="Updates only the consignment item metaobject. Shopify product data and media are handled separately below."
        />

        <div className="consignment-status-card">
          {!isSold && (
            <div className="consignment-manual-sale">
              <div className="consignment-manual-sale-copy"><strong>Manual sale</strong><span>Only use for a sale outside Shopify.</span></div>
              <div className="consignment-manual-sale-controls">
                <div className="consignment-field"><label className="consignment-label">Sale price</label><input className="consignment-input" type="number" inputMode="decimal" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></div>
                <button className="consignment-btn consignment-sold-btn" disabled={statusSaving || salePrice === ''} onClick={async () => { setStatusSaving(true); try { await onUpdateStatus(item.id, 'Sold', { salePrice, dateSold }); } finally { setStatusSaving(false); } }}>Sold</button>
              </div>
            </div>
          )}
          {isSold && !isPaid && <div className="consignment-sold-status"><span className="consignment-badge unpaid">Sold · unpaid</span><span className="consignment-row-sub">Waiting in Payouts for payment.</span></div>}
          {isPaid && <div className="consignment-status-actions"><span className="consignment-badge paid">Paid</span><span className="consignment-paid-detail">{item.payoutDate || ''} · {item.payoutMethod || 'Payment recorded'} · {money(item.payoutAmount)}</span></div>}
        </div>

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
            try { await onSyncProduct(item.id, shopifyForm); } finally { setSyncing(false); }
          }}
        />

        {!confirmingDelete ? (
          <button className="consignment-btn secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger-soft)' }} onClick={() => setConfirmingDelete(true)}><Trash2 size={16} /> Delete item</button>
        ) : (
          <div className="consignment-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>Delete {item.itemNumber} and its linked Shopify product?</span>
            <div style={{ display: 'flex', gap: 8 }}><button className="consignment-btn secondary" style={{ padding: '8px 14px' }} onClick={() => setConfirmingDelete(false)}>Cancel</button><button className="consignment-btn danger" style={{ padding: '8px 14px' }} onClick={() => onDelete(item.id)}>Delete</button></div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- app ---------- */

export default function ConsignmentIntakeApp({ activePlan = null }) {
  const tier2Enabled = activePlan === 'TIER2';
  const [ready, setReady] = useState(false);
  const [consignors, setConsignors] = useState([]);
  const [items, setItems] = useState([]);
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
  const [error, setError] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  function errorMessage(value, fallback) {
    return value instanceof Error ? value.message : fallback;
  }

  async function refreshData() {
    const data = await getConsignmentData();
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
    document.querySelector('.consignment-body')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setShowBackToTop(false);
  }, [view]);

  useEffect(() => {
    if (!ready) return undefined;
    const body = document.querySelector('.consignment-body');
    const updateBackToTop = () => {
      setShowBackToTop(window.scrollY > 280 || (body?.scrollTop || 0) > 280);
    };
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
    document.querySelector('.consignment-body')?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
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
      if (kind === 'consignors') {
        flash(`${result.consignorsCreated || 0} created, ${result.consignorsUpdated || 0} matched/updated, ${result.itemsImported || 0} items imported, ${result.shopifyProductsCreated || 0} Shopify products created`);
      } else {
        const importedCount = result.itemsImported ?? result.imported;
        flash(`${importedCount} item${importedCount === 1 ? '' : 's'} imported, ${result.shopifyProductsCreated || 0} Shopify products created`);
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

  // Lets "Create Shopify product" work standalone on the Add Items screen,
  // without requiring "Save manual item" to have been clicked first. Saves
  // the manual consignment record(s) — the current form entry plus anything
  // already queued in the batch, so nothing queued gets silently lost — and
  // creates the Shopify product for the current item, in one action.
  async function handleSaveAndSync(currentEntry, queuedBatch, shopifyForm) {
    try {
      setError('');
      const saved = await createConsignmentItems(activeId, [...queuedBatch, currentEntry]);
      const newItem = saved[saved.length - 1];
      await syncShopifyProduct(newItem.id, shopifyForm);
      await refreshData();
      flash(`${saved.length} item${saved.length === 1 ? '' : 's'} saved · Shopify product created`);
      setView('consignor');
    } catch (e) {
      setError(errorMessage(e, 'Could not save the item and create the Shopify product'));
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
      flash(status === 'Paid' ? 'Item marked paid' : status === 'Sold' ? 'Item marked sold · unpaid' : 'Item returned to available');
    } catch (e) {
      setError(errorMessage(e, 'Could not update item status'));
      throw e;
    }
  }

  async function handleSyncProduct(itemId, shopifyForm) {
    try {
      setError('');
      await syncShopifyProduct(itemId, shopifyForm);
      await refreshData();
      flash('Shopify product synced');
    } catch (e) {
      setError(errorMessage(e, 'Could not sync the Shopify product'));
      throw e;
    }
  }

  async function handleRecordPayout(payout) {
    try {
      setError('');
      const result = await recordConsignorPayout(payout);
      await refreshData();
      flash(`Payout of ${money(result.payout.total)} recorded`);
      setView('payouts');
    } catch (e) {
      setError(errorMessage(e, 'Could not record payout'));
      throw e;
    }
  }

  async function handleDeleteItemFromEdit(itemId) {
    await handleDeleteItem(itemId);
    setView('consignor');
  }

  const activeConsignor = consignors.find((c) => c.id === activeId);
  const activeItem = items.find((i) => i.id === activeItemId);
  const nextConsignorNumber = Math.max(0, ...consignors.map((consignor) => Number(consignor.number) || 0)) + 1;
  const navigationView = ['newConsignor', 'chooseConsignor', 'consignor', 'intake', 'editConsignor'].includes(view)
    ? 'home'
    : view === 'editItem'
      ? 'items'
      : view === 'createPayout'
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
    if (!consignors.length) {
      startNewConsignor('intake', 'dashboard');
      return;
    }
    setView('chooseConsignor');
  }

  return (
    <div className="consignment">
      <GlobalStyle />
      {ready && <AppNavigation view={navigationView} onNavigate={navigate} />}
      {toast && <div className="consignment-toast"><Check size={14} /> {toast}</div>}
      {error && (
        <div className="consignment-toast" style={{ background: 'var(--danger)', top: 12 }}>
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
        <HomeScreen
          consignors={consignors}
          items={items}
          query={query}
          setQuery={setQuery}
          onOpenConsignor={openConsignor}
          onOpenItem={openItem}
          onMarkSold={(itemId, details) => handleUpdateItemStatus(itemId, 'Sold', details)}
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
          onOpenItem={openItem}
          onOpenConsignor={openConsignor}
          onMarkSold={(itemId, details) => handleUpdateItemStatus(itemId, 'Sold', details)}
          onNewItem={startNewItem}
        />
      )}

      {ready && view === 'sales' && (
        <SalesScreen
          items={items}
          consignors={consignors}
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

      {ready && view === 'createPayout' && activeConsignor && (
        <CreatePayoutScreen
          consignor={activeConsignor}
          items={items}
          onBack={() => setView('payouts')}
          onRecordPayout={handleRecordPayout}
        />
      )}

      {ready && view === 'import' && (
        <ImportScreen
          kind={importKind}
          fixedConsignor={consignors.find((entry) => entry.id === importConsignorId) || null}
          onBack={() => setView(importBack)}
          onImport={handleImport}
        />
      )}

      {ready && view === 'newConsignor' && (
        <NewConsignorScreen onBack={() => setView(newConsignorBack)} onSave={handleNewConsignor} nextNumber={nextConsignorNumber} />
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
        <ConsignorScreen
          consignor={activeConsignor}
          items={items}
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
        <EditConsignorScreen
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
          onBack={() => setView('consignor')}
          onSave={handleUpdateItem}
          onDelete={handleDeleteItemFromEdit}
          onSyncProduct={handleSyncProduct}
          onUpdateStatus={handleUpdateItemStatus}
          tier2Enabled={tier2Enabled}
        />
      )}

      {ready && showBackToTop && (
        <button className="consignment-back-to-top" type="button" onClick={scrollToTop} aria-label="Back to top" title="Back to top">
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
