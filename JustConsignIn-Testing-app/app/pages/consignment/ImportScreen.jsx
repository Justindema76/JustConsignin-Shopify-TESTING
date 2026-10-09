/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState } from 'react';
import { Download, FileUp, Loader2 } from 'lucide-react';
import Header from '../../components/consignment/Header';
import { parseCsv } from '../../lib/csv';

export default function ImportScreen({
  kind,
  onBack,
  onImport,
  fixedConsignor = null,
}) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [localError, setLocalError] = useState('');
  const [saving, setSaving] = useState(false);
  const isConsignors = kind === 'consignors';
  const required = isConsignors
    ? 'consignor_import_key, first_name, last_name; item_description and price when the row contains an item'
    : fixedConsignor
      ? 'item_description, price'
      : 'consignor_import_key (or email/phone), item_description, price';
  const templateConsignorNumber = fixedConsignor?.number || 1;
  const itemColumns =
    'item_import_key,item_description,price,category,item_type,brand,size,condition,item_notes,status,date_received,consignment_term,expiry_action,create_shopify_product,shopify_title,shopify_price,shopify_description,shopify_vendor,shopify_tags,publish_to_pos,publish_online,seo_title,seo_description,sale_price,sale_date,payout_status';
  const template = isConsignors
    ? `consignor_import_key,first_name,last_name,phone,email,address,city,province,postal_code,date_joined,commission_pct,unsold_preference,consignor_notes,${itemColumns}\njane-smith-9055550100,Jane,Smith,905-555-0100,jane@example.com,123 Main Street,Hamilton,Ontario,L8E 1A1,2026-07-30,50,Please return,,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`
    : fixedConsignor
      ? `${itemColumns},consignor_number\nitem-001,Blue baby sweater,18.00,Clothing,Sweater,Gap,12M,Good,,Available,2026-07-30,60,Please return,true,Blue baby sweater,18.00,Soft blue baby sweater,Gap,baby|sweater,true,false,Blue baby sweater,Soft blue baby sweater,,,${templateConsignorNumber}`
      : `consignor_import_key,email,phone,${itemColumns}\njane-smith-9055550100,jane@example.com,905-555-0100,jane-001,Blue winter coat,45.00,Clothing,Jacket,Gap,Medium,Like new,,Available,2026-07-30,90,Please return,true,Blue winter coat,45.00,Warm blue winter coat,Gap,winter|coat,true,true,Blue winter coat,Warm blue winter coat for sale,,,`;
  function downloadTemplate() {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${kind}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      let parsed = parseCsv(await file.text());
      if (!isConsignors && fixedConsignor) {
        parsed = parsed.map((row) => ({
          ...row,
          consignor_number: fixedConsignor.number,
        }));
      }
      setRows(parsed);
      setFileName(file.name);
      setLocalError('');
    } catch (error) {
      setRows([]);
      setFileName(file.name);
      setLocalError(error.message);
    }
  }
  return (
    <>
      <Header
        eyebrow="Data import"
        title={
          isConsignors
            ? 'Import consignors and items'
            : fixedConsignor
              ? `Import items for ${fixedConsignor.firstName} ${fixedConsignor.lastName}`
              : 'Import items'
        }
        onBack={onBack}
      />
      <div className="consignment-body">
        <div className="consignment-card">
          <strong style={{ fontSize: 14 }}>Start with the template</strong>
          <p className="consignment-import-help">
            Required columns: {required}. The app assigns consignor and item
            numbers automatically. Keep the headings unchanged, fill in your
            rows, then save as CSV.
            {fixedConsignor && !isConsignors
              ? ` Every row will be assigned to consignor #${fixedConsignor.number}.`
              : ''}
          </p>
          <button
            className="consignment-btn secondary"
            onClick={downloadTemplate}
          >
            <Download size={16} /> Download template
          </button>
        </div>
        <div className="consignment-import-drop">
          <label>
            <FileUp size={24} />
            <span>{fileName || 'Choose CSV file'}</span>
            <input type="file" accept=".csv,text/csv" onChange={chooseFile} />
          </label>
          <div className="consignment-import-help">
            Nothing is imported until you review the count and press Import.
          </div>
        </div>
        {localError && (
          <div className="consignment-card" style={{ color: 'var(--danger)' }}>
            {localError}
          </div>
        )}
        {rows.length > 0 && (
          <>
            <div className="consignment-import-preview">
              <div>
                <span>File</span>
                <strong style={{ fontSize: 12 }}>{fileName}</strong>
              </div>
              <div>
                <span>Rows ready</span>
                <strong>{rows.length}</strong>
              </div>
              <div>
                <span>Importing</span>
                <strong style={{ fontSize: 13 }}>
                  {isConsignors
                    ? 'Consignors + items · Shopify supported'
                    : 'Items · Shopify supported'}
                </strong>
              </div>
            </div>
            <div className="consignment-import-actions">
              <button
                className="consignment-btn"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onImport(kind, rows);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? (
                  <Loader2 className="consignment-spin" size={16} />
                ) : (
                  <FileUp size={16} />
                )}{' '}
                Import {rows.length} row{rows.length === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
