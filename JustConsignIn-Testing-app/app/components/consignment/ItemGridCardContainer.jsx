/* eslint-disable react/prop-types */

import {
  money,
  itemBadge,
  productLabel,
  statusClass,
  statusLabel,
} from '../../lib/consignmentHelpers';

import {
  ItemAction,
} from './AllConsignorView';

import '../../styles/by-consignor-container.css';
import '../../styles/consignment-card-grid.css';


export default function ItemGridCardContainer({
  item,
  consignor,
  showConsignor = true,
  onOpenItem,
  onOpenConsignor,
  onStartPayout,
  saleSourceMode = false,
}) {
  const product = saleSourceMode ? itemBadge(item) : productLabel(item);

  const photo =
    item.shopifyPhoto ||
    item.photo;

  const isSold =
    item.status === 'Sold' ||
    Boolean(item.dateSold);

  const salePrice =
    Number(
      item.salePrice ??
        item.price ??
        0,
    );

  const commissionPct =
    Number(
      item.commissionPct ??
        consignor?.commissionPct ??
        0,
    );

  const consignorDue =
    (
      salePrice *
      commissionPct
    ) /
    100;

  return (
    <article className="consignment-readable-card">

      <div className="consignment-readable-card-top">

        <button
          type="button"
          className="consignment-grid-item-open"
          onClick={() =>
            onOpenItem?.(item.id)
          }
        >
          <div className="consignment-grid-thumb-row">

            {item.shopifyProductId && (
              <span
                className={`consignment-grid-thumb ${
                  photo
                    ? ''
                    : 'consignment-image-placeholder'
                }`}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                  />
                ) : (
                  <span aria-hidden="true">
                    No image
                  </span>
                )}
              </span>
            )}

            <span className="consignment-readable-title-copy">

              <strong>
                {item.description ||
                  item.type ||
                  'Consignment item'}
              </strong>

              <small className="consignment-readable-card-sku">

                <b>
                  SKU {item.itemNumber || '—'}
                </b>

                {item.size ? (
                  <span>
                    {' '}· {item.size}
                  </span>
                ) : null}

                {item.brand ? (
                  <span>
                    {' '}· {item.brand}
                  </span>
                ) : null}

              </small>

            </span>

          </div>
        </button>


        <div className="consignment-readable-product-row">

          <span
            className={`consignment-product-badge ${product.className}`}
          >
            {product.text}
          </span>

        </div>

      </div>


      {showConsignor && (
        consignor ? (
          <button
            type="button"
            className="consignment-readable-consignor-link"
            onClick={() =>
              onOpenConsignor?.(
                consignor.id,
              )
            }
          >
            {consignor.firstName}{' '}
            {consignor.lastName}
          </button>
        ) : (
          <span className="consignment-readable-consignor-link consignment-grid-unassigned">
            Unassigned
          </span>
        )
      )}


      <div className="consignment-readable-card-meta consignment-sales-money-rows">

        {isSold ? (
          <>

            <span>
              <small>
                Sale price
              </small>

              <strong>
                {money(salePrice)}
              </strong>
            </span>

            <span>
              <small>
                Consignor due
              </small>

              <strong>
                {money(consignorDue)}
              </strong>
            </span>

          </>
        ) : (
          <>

            <span>
              <small>
                Price
              </small>

              <strong>
                {money(item.price)}
              </strong>
            </span>

            <span>
              <small>
                Commission
              </small>

              <strong>
                {commissionPct}%
              </strong>
            </span>

          </>
        )}

      </div>


<div className="consignment-readable-card-details">
        <div className="consignment-readable-card-date-rows">

          <div className="consignment-readable-card-date-row">
            <small>Date received</small>

            <strong>
              {item.dateReceived || '—'}
            </strong>
          </div>

          {isSold && (
            <div className="consignment-readable-card-date-row">
              <small>Sale date</small>

              <strong>
                {item.dateSold || '—'}
              </strong>
            </div>
          )}

          <div className="consignment-readable-card-date-row">
            <small>Status</small>

            <span
              className={`consignment-badge ${
                item.paidOut
                  ? 'paid'
                  : statusClass(item.status)
              }`}
            >
              {item.paidOut
                ? 'Paid'
                : statusLabel(item.status)}
            </span>
          </div>

        </div>
      </div>

      {item.expiryDate && (
        <div className="consignment-sales-grid-order">
          Expiry {item.expiryDate}
        </div>
      )}


      <div className="consignment-readable-card-actions">

        <ItemAction
          item={item}
          product={product}
          consignor={consignor}
          onOpenItem={onOpenItem}
          onStartPayout={onStartPayout}
        />

      </div>

    </article>
  );
}