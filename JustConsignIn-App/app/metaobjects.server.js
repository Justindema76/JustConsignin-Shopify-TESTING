const DEFINITIONS = [
  {
    type: "consignor",
    name: "Consignor",
    fieldDefinitions: [
      { key: "number", name: "Consignor Number", type: "number_integer" },
      { key: "first_name", name: "First Name", type: "single_line_text_field" },
      { key: "last_name", name: "Last Name", type: "single_line_text_field" },
      { key: "phone", name: "Phone", type: "single_line_text_field" },
      { key: "email", name: "Email", type: "single_line_text_field" },
      { key: "date_joined", name: "Date Joined", type: "date" },
      { key: "commission_pct", name: "Commission %", type: "number_integer" },
      { key: "notes", name: "Consignor Details", type: "multi_line_text_field" },
    ],
  },
  {
    type: "consignment_item",
    name: "Consignment Item",
    fieldDefinitions: [
      { key: "item_number", name: "Item Number", type: "single_line_text_field" },
      {
        key: "consignor",
        name: "Consignor",
        type: "metaobject_reference",
        validations: [
          {
            name: "metaobject_definition_id",
            value: "__CONSIGNOR_DEFINITION_ID__",
          },
        ],
      },
      { key: "date_received", name: "Date Received", type: "date" },

      // Expiry tracking
      {
        key: "consignment_term",
        name: "Consignment Term",
        type: "single_line_text_field",
      },
      {
        key: "expiry_date",
        name: "Expiry Date",
        type: "date",
      },
      {
        key: "expiry_action",
        name: "Expiry Action",
        type: "single_line_text_field",
      },

      { key: "category", name: "Category", type: "single_line_text_field" },
      { key: "item_type", name: "Item Type", type: "single_line_text_field" },
      { key: "description", name: "Description", type: "multi_line_text_field" },
      { key: "size", name: "Size", type: "single_line_text_field" },
      { key: "condition", name: "Condition", type: "single_line_text_field" },
      { key: "price", name: "Price", type: "number_decimal" },
      { key: "commission_pct", name: "Commission %", type: "number_integer" },
      { key: "status", name: "Status", type: "single_line_text_field" },
      { key: "brand", name: "Brand", type: "single_line_text_field" },
      { key: "photo", name: "Photo", type: "file_reference" },
      { key: "shopify_product", name: "Shopify Product", type: "product_reference" },
      { key: "shopify_title", name: "Shopify Title", type: "single_line_text_field" },
      { key: "shopify_price", name: "Shopify Price", type: "number_decimal" },
      {
        key: "shopify_description",
        name: "Shopify Description",
        type: "multi_line_text_field",
      },
      { key: "shopify_vendor", name: "Shopify Vendor", type: "single_line_text_field" },
      { key: "shopify_tags", name: "Shopify Tags", type: "multi_line_text_field" },
      {
        key: "shopify_category_id",
        name: "Shopify Category ID",
        type: "single_line_text_field",
      },
      {
        key: "shopify_category_name",
        name: "Shopify Category Name",
        type: "single_line_text_field",
      },
      { key: "seo_title", name: "SEO Title", type: "single_line_text_field" },
      {
        key: "seo_description",
        name: "SEO Description",
        type: "multi_line_text_field",
      },
      {
        key: "publish_to_pos",
        name: "Publish to Point of Sale",
        type: "boolean",
      },
      {
        key: "publish_online",
        name: "Publish to Online Store",
        type: "boolean",
      },
      { key: "notes", name: "Item Details", type: "multi_line_text_field" },
      { key: "sale_price", name: "Sale Price", type: "number_decimal" },
      { key: "date_sold", name: "Date Sold", type: "date" },
      { key: "order_name", name: "Order Name", type: "single_line_text_field" },
      { key: "order_id", name: "Order ID", type: "single_line_text_field" },
      { key: "paid_out", name: "Paid Out", type: "boolean" },
    ],
  },
];

const GET_DEFINITION = `#graphql
  query GetMetaobjectDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      type
      fieldDefinitions { key }
    }
  }
`;

const CREATE_DEFINITION = `#graphql
  mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message code }
    }
  }
`;

const UPDATE_DEFINITION = `#graphql
  mutation UpdateMetaobjectDefinition(
    $id: ID!
    $definition: MetaobjectDefinitionUpdateInput!
  ) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition {
        id
        type
        fieldDefinitions { key }
      }
      userErrors { field message code }
    }
  }
`;

async function graphql(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(
      payload.errors.map((error) => error.message).join(", "),
    );
  }

  return payload.data;
}

function assertNoUserErrors(result, operation) {
  const errors = result?.userErrors || [];

  if (errors.length) {
    throw new Error(
      `${operation}: ${errors
        .map((error) => error.message)
        .join(", ")}`,
    );
  }
}

async function ensureDefinition(admin, definition) {
  const existingData = await graphql(
    admin,
    GET_DEFINITION,
    { type: definition.type },
  );

  const existing = existingData.metaobjectDefinitionByType;

  if (!existing) {
    const createData = await graphql(
      admin,
      CREATE_DEFINITION,
      { definition },
    );

    assertNoUserErrors(
      createData.metaobjectDefinitionCreate,
      `Could not create ${definition.name}`,
    );

    return {
      id: createData.metaobjectDefinitionCreate.metaobjectDefinition.id,
      type: definition.type,
      action: "created",
    };
  }

  const existingKeys = new Set(
    existing.fieldDefinitions.map((field) => field.key),
  );

  const missingFields = definition.fieldDefinitions.filter(
    (field) => !existingKeys.has(field.key),
  );

  if (missingFields.length) {
    const updateData = await graphql(
      admin,
      UPDATE_DEFINITION,
      {
        id: existing.id,
        definition: {
          fieldDefinitions: missingFields.map((field) => ({
            create: field,
          })),
        },
      },
    );

    assertNoUserErrors(
      updateData.metaobjectDefinitionUpdate,
      `Could not repair ${definition.name}`,
    );

    return {
      id: existing.id,
      type: definition.type,
      action: "updated",
      addedFields: missingFields.map((field) => field.key),
    };
  }

  return {
    id: existing.id,
    type: definition.type,
    action: "unchanged",
  };
}

// Safe to run after every authentication.
// It creates missing definitions and adds fields introduced by newer app versions.
export async function ensureMetaobjectsInstalled(
  admin,
  shop = "unknown shop",
) {
  try {
    const results = [];

    // Consignor must exist before the item definition because
    // the item schema contains a metaobject reference to it.
    const consignorResult = await ensureDefinition(
      admin,
      DEFINITIONS[0],
    );

    results.push(consignorResult);

    const itemDefinition = {
      ...DEFINITIONS[1],
      fieldDefinitions: DEFINITIONS[1].fieldDefinitions.map(
        (field) => ({
          ...field,
          validations: field.validations?.map(
            (validation) => ({
              ...validation,
              value:
                validation.value ===
                "__CONSIGNOR_DEFINITION_ID__"
                  ? consignorResult.id
                  : validation.value,
            }),
          ),
        }),
      ),
    };

    results.push(
      await ensureDefinition(
        admin,
        itemDefinition,
      ),
    );

    console.log(
      `Metaobject setup completed for ${shop}`,
      results,
    );

    return {
      ok: true,
      results,
      errors: [],
    };
  } catch (error) {
    console.error(
      `Metaobject setup failed for ${shop}:`,
      error,
    );

    return {
      ok: false,
      results: [],
      errors: [
        {
          message: error.message,
        },
      ],
    };
  }
}