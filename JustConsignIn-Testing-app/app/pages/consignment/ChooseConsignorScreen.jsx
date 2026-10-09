/* eslint-disable react/prop-types, jsx-a11y/label-has-associated-control */
import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import ConsignmentFilterBar from '../../components/consignment/ConsignmentFilterBar';
import Header from '../../components/consignment/Header';

export default function ChooseConsignorScreen({
  consignors,
  onBack,
  onChoose,
  onCreate,
}) {
  const [search, setSearch] = useState('');
  const filtered = consignors.filter((consignor) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      `${consignor.firstName} ${consignor.lastName} ${consignor.number}`
        .toLowerCase()
        .includes(query)
    );
  });
  return (
    <>
      <Header eyebrow="New item" title="Choose consignor" onBack={onBack} />
      <div className="consignment-body">
        <button
          type="button"
          className="consignment-quick-action primary"
          onClick={onCreate}
          style={{ width: '100%', marginBottom: 14 }}
        >
          <span className="consignment-quick-action-icon">
            <Plus size={19} />
          </span>
          <span className="consignment-quick-action-copy">
            <strong>Create new consignor</strong>
            <span>Add their details, then continue directly to the item</span>
          </span>
        </button>
        <ConsignmentFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search name or consignor number',
          }}
        />
        {filtered.map((consignor) => (
          <button
            key={consignor.id}
            type="button"
            className="consignment-row-btn"
            onClick={() => onChoose(consignor.id)}
          >
            <div className="consignment-avatar">
              {consignor.firstName?.[0]}
              {consignor.lastName?.[0]}
            </div>
            <div className="consignment-row-main">
              <div className="consignment-row-name">
                {consignor.firstName} {consignor.lastName}
              </div>
              <div className="consignment-row-sub">
                Consignor #{consignor.number}
              </div>
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
