# Product CRUD

- **Status:** Ready for implementation
- **Scope:** Backend only
- **Target service:** `apps/shop` (`@repo/shop`)
- **Database package:** `packages/database` (`@repo/database`)
- **Primary route scope:** Authenticated, owner-scoped product management

## 1. Summary

Free POS currently supports shop records but has no product persistence or product-management API. This feature adds the backend foundation for shop owners to manage a basic product catalog.

The feature is intentionally limited to catalog master data. It does not implement public product browsing, inventory, orders, or other downstream POS workflows.

## 2. Goals

1. Allow an authenticated shop owner to create products for their shop.
2. Allow an owner to list and retrieve their products.
3. Allow an owner to replace and hard-delete their products.
4. Enforce shop ownership on every product operation.
5. Store a server-generated product slug for future public catalog routes.
6. Follow the existing `apps/shop` conventions for validation, repositories, responses, errors, pagination, and integration tests.
7. Add the database schema and generated migration required for the feature.

## 3. Non-goals

The following are explicitly out of scope:

- Public product endpoints such as `/:shopSlug/:productSlug`.
- Frontend product screens, hooks, queries, or API clients.
- Search, filtering, and sorting.
- SKU or barcode support.
- Inventory quantities, stock adjustments, or low-stock rules.
- Orders, sales history, receipts, or product references from transactions.
- Categories, variants, images, suppliers, or tax configuration.
- Currency metadata, currency conversion, or exchange rates.
- Product slug aliases, redirects, or historical slug lookup.
- Staff roles, shop memberships, or cross-shop product access.

The product slug is stored and returned by the private API so a later public-catalog feature can use it. Public slug routes are a separate feature and must not be added as part of this work.

## 4. Users and authorization

### Primary user

An authenticated shop owner managing the catalog for their own shop.

### Authorization model

- Every product endpoint requires `requireAuth` from `@repo/auth-kit`.
- A product belongs to exactly one shop through `product.shopId`.
- The authenticated user may operate only on the shop returned by the existing owner lookup (`ownerUserId = c.var.userId`).
- The current repository has one shop per user and no staff or membership model. This PRD does not add one.
- Product queries must be scoped by both the authenticated owner’s shop and, for item operations, the product ID.
- A product belonging to another shop must be indistinguishable from a missing product and return `404 Not Found`.
- A user without a shop receives `404 Not Found` for product collection and item operations.

## 5. Product data model

Add a `product` table to `packages/database/src/schema.ts`.

| Column | Type | Nullability/default | Rules |
| --- | --- | --- | --- |
| `id` | `varchar(36)` | Primary key | UUIDv7-style ID, generated using the repository convention |
| `shopId` | `varchar(36)` | Required | Foreign key to `shop.id`; `onDelete: "cascade"` |
| `name` | `varchar(255)` | Required | Trimmed, non-empty product name |
| `slug` | `varchar(64)` | Required | Server-generated lowercase kebab-case slug |
| `description` | `text` | Nullable | API maximum of 200 characters |
| `priceMinor` | Integer | Required | Non-negative integer in the smallest price unit |
| `isActive` | Boolean | Required, no default | Must be explicitly supplied by both `POST` and `PUT` |
| `createdAt` | Timestamp | Required, `defaultNow()` | Creation timestamp |
| `updatedAt` | Timestamp | Required, `defaultNow().onUpdateNow()` | Last-update timestamp |

### Price representation

`priceMinor` is an integer and must never use floating-point values. This PRD does not define a currency field or currency conversion behavior. The unit represented by `priceMinor` must be established by a future pricing/currency configuration feature.

### Indexes and relationships

- Primary key on `product.id`.
- Foreign key from `product.shopId` to `shop.id` with cascading deletion.
- Compound unique index on `(shopId, slug)`.
- No global slug uniqueness constraint is required.

Deleting a shop must delete its products through the database foreign-key cascade. Product deletion is a hard delete; no `deletedAt` column or archive workflow is required.

## 6. Slug rules

The slug is a server-managed representation derived from the product name.

- Normalize using the existing shop slug convention:
  - lowercase ASCII characters,
  - replace runs of non-alphanumeric characters with `-`,
  - remove leading and trailing hyphens,
  - maximum length of 64 characters.
- The client must not provide a `slug` field in create or update request bodies.
- The slug must be unique within the owning shop.
- A product name change regenerates the slug.
- If the generated slug is already used by another product in the same shop, return `409 Conflict` and do not modify the product.
- Do not append automatic suffixes such as `-2`.
- If the name cannot produce a valid slug, return `422 Unprocessable Entity`.
- Because private item routes use IDs, changing a slug does not invalidate the private item route. Future public routes must account for the fact that slugs can change.

The uniqueness constraint is the final authority during concurrent creates or updates. Repository code must translate duplicate-key errors into the product slug conflict error rather than exposing a driver error.

## 7. API surface

All routes below are mounted by `apps/shop` and require authentication.

| Method | Path | Purpose | Success |
| --- | --- | --- | --- |
| `POST` | `/shops/me/products` | Create a product for the authenticated owner’s shop | `201` |
| `GET` | `/shops/me/products` | List the owner’s products | `200` |
| `GET` | `/shops/me/products/:id` | Retrieve one owned product by ID | `200` |
| `PUT` | `/shops/me/products/:id` | Fully replace one owned product by ID | `200` |
| `DELETE` | `/shops/me/products/:id` | Hard-delete one owned product by ID | `200` |

No public product route is part of this feature.

### 7.1 Create product

```http
POST /shops/me/products
Content-Type: application/json
```

Request body:

```json
{
  "name": "Arabica Coffee",
  "description": "250g bag",
  "priceMinor": 1299,
  "isActive": true
}
```

All four fields are required. `description` may be `null`, but the property must be present. `isActive` is required and has no implicit API or database default.

Success response:

```http
201 Created
```

```json
{
  "message": "Product created.",
  "data": {
    "product": {
      "id": "0192...",
      "shopId": "0191...",
      "name": "Arabica Coffee",
      "slug": "arabica-coffee",
      "description": "250g bag",
      "priceMinor": 1299,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

The handler should insert the product using the authenticated owner’s shop ID, read the created record back, and return the full product representation.

### 7.2 List products

```http
GET /shops/me/products?cursor=<opaque-cursor>
```

Supported query parameter:

- `cursor`: optional opaque cursor encoded from the product ID.

The list must:

- include both active and inactive products,
- order products newest-first by ID, following the existing shop-list convention,
- return at most 10 products per page,
- return an opaque `nextCursor` when another page exists,
- reject malformed cursors with the existing validation error shape.

Response:

```json
{
  "message": "ok",
  "data": {
    "data": [
      {
        "id": "0192...",
        "shopId": "0191...",
        "name": "Arabica Coffee",
        "slug": "arabica-coffee",
        "description": "250g bag",
        "priceMinor": 1299,
        "isActive": true,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "nextCursor": null
    }
  }
}
```

Do not add `limit`, search, filter, or sort query parameters in this iteration.

### 7.3 Retrieve a product

```http
GET /shops/me/products/:id
```

Return the full product representation in the established envelope:

```json
{
  "message": "ok",
  "data": {
    "product": {}
  }
}
```

The product ID must be validated before repository access. A malformed or unknown ID returns the applicable `400` or `404` response.

### 7.4 Replace a product

```http
PUT /shops/me/products/:id
Content-Type: application/json
```

Request body:

```json
{
  "name": "Arabica Coffee",
  "description": "Updated description",
  "priceMinor": 1399,
  "isActive": false
}
```

`PUT` is a complete replacement of all mutable fields. Every request body property is required, although `description` may be `null`.

The following fields must not be accepted from the client:

- `id`
- `shopId`
- `slug`
- `createdAt`
- `updatedAt`

The handler must derive the new slug from the new name. If the new slug conflicts with another product, return `409` and leave the existing row unchanged. On success, return the updated product, including its regenerated slug:

```json
{
  "message": "Product updated.",
  "data": {
    "product": {}
  }
}
```

### 7.5 Delete a product

```http
DELETE /shops/me/products/:id
```

Deletion is a hard delete. Return:

```http
200 OK
```

```json
{
  "message": "Product deleted."
}
```

Do not return `204 No Content`; the service uses an envelope for successful deletes.

## 8. Validation rules

Request validation must use the existing Valibot middleware and return the established validation envelope:

```json
{
  "message": "Validation failed.",
  "error": {
    "field": {
      "message": "..."
    }
  }
}
```

Validation failures return `400 Bad Request`.

### Body validation

- `name`:
  - string,
  - trimmed before use,
  - non-empty after trimming,
  - maximum 255 characters.
- `description`:
  - required property,
  - string or `null`,
  - maximum 200 characters when non-null.
- `priceMinor`:
  - required integer,
  - minimum value `0`,
  - no decimal or floating-point representation.
- `isActive`:
  - required boolean,
  - no default value.
- Unknown properties should be rejected by the request schema.

### Path and query validation

- `id` must match the repository’s UUID format.
- `cursor` must be decoded using the existing cursor helper.
- Invalid IDs and cursors return `400`.

### Slug-generation validation

A valid-looking name that cannot produce a slug returns `422` with a stable product-specific message. Slug uniqueness failures return `409`.

## 9. Error behavior

| Situation | Status | Behavior |
| --- | ---: | --- |
| Missing/invalid authentication | `401` | Use `requireAuth`; do not implement local auth |
| Invalid body, ID, or cursor | `400` | Existing validation envelope |
| Product name cannot produce a slug | `422` | Product-specific invalid-name message |
| User has no shop | `404` | Do not create or expose products without an owned shop |
| Product does not exist | `404` | Product-specific not-found message |
| Product belongs to another shop | `404` | Do not disclose cross-shop existence |
| Slug conflict | `409` | No partial write; stable conflict message |
| Unexpected failure | `500` | Existing global error handler response |

Expected persistence failures must be normalized at the repository boundary. Raw TiDB/MySQL duplicate-key messages must not be returned to clients.

## 10. Backend structure

Follow the existing backend conventions and keep HTTP, persistence, and database boundaries separate.

Expected implementation surface:

```text
packages/database/src/schema.ts                 # product table and indexes
packages/database/drizzle/<generated>.sql       # generated migration

apps/shop/src/errors.ts                         # product-specific expected errors
apps/shop/src/repositories/product.repository.ts
apps/shop/src/modules/product/product.routes.ts
apps/shop/src/modules/product/product.handlers.ts
apps/shop/src/modules/product/product.schema.ts
apps/shop/src/modules/shop/shop.routes.ts       # mount product routes
apps/shop/test/routes/product.test.ts
```

### Repository responsibilities

`ProductRepository` is the only application layer that imports the product table from `@repo/database`.

It should expose methods sufficient for:

- finding a product by ID within a shop,
- inserting a product,
- updating all mutable fields within a shop,
- deleting a product within a shop,
- listing a shop’s products with cursor pagination.

Repository methods accept `DatabaseExecutor` so they remain compatible with the existing database and transaction types.

The repository must:

- scope every operation by `shopId` where applicable,
- normalize the compound unique-index violation into a typed product slug error,
- preserve atomicity when an update generates a conflicting slug.

No service layer is required for the basic single-repository operations. Add a product service only if implementation requires a multi-repository workflow or explicit transaction orchestration.

### Handler responsibilities

Handlers may:

- apply authentication and request validation,
- resolve the authenticated owner’s shop,
- call repositories,
- translate expected errors into HTTP responses,
- return the established response envelopes.

Handlers must not import Drizzle tables or execute raw database queries.

## 11. Acceptance criteria and tests

Add route-level integration tests using the existing Worker test setup and test database conventions.

### Authentication and ownership

- Unauthenticated requests to every product route return `401`.
- An authenticated user without a shop receives `404`.
- An owner can access only products belonging to their own shop.
- A product belonging to another shop returns `404` for detail, update, and delete attempts.

### Create

- A valid request creates a product and returns `201`.
- The response contains the complete product representation.
- The slug is derived from the name.
- `isActive` must be explicitly provided.
- A missing or invalid required field returns `400`.
- A description longer than 200 characters returns `400`.
- A negative, decimal, or non-integer `priceMinor` returns `400`.
- A name that cannot produce a slug returns `422`.
- A duplicate slug within the same shop returns `409`.
- The same slug may exist in a different shop.

### List and detail

- The list returns both active and inactive products.
- The list is ordered newest-first.
- The list uses the existing opaque cursor format and page size of 10.
- Invalid cursors return `400`.
- Detail returns the full product representation.
- Unknown product IDs return `404`.
- Malformed product IDs return `400`.

### Update

- `PUT` requires the complete mutable body.
- `isActive` is required on update.
- Client-supplied `slug`, `id`, `shopId`, or timestamps are rejected by validation and must never overwrite server-owned values.
- Updating the name regenerates the slug.
- A conflicting regenerated slug returns `409` and does not partially update the product.
- A valid update returns `200` and the new product representation.

### Delete

- An owner can hard-delete a product and receives `200` with the delete message.
- A deleted product can no longer be retrieved.
- Deleting a shop cascades to its products.
- Deleting a missing or cross-shop product returns `404`.

### Contract and regression coverage

- Successful responses use the existing `{ message, data }` envelope.
- Delete uses `200` with a message rather than `204`.
- No response contains a `currency` field.
- Existing shop and authentication route tests continue to pass.

## 12. Migration and rollout

1. Add the `product` table and indexes to `packages/database/src/schema.ts`.
2. Generate the migration with the existing database workflow; do not hand-edit generated migration files.
3. Apply the migration to the test database before running product integration tests.
4. Deploy the database migration before deploying the Worker code that references the new table.
5. Deploy the updated `apps/shop` Worker.

The migration is additive and requires no backfill because no product records currently exist. Existing shop and authentication routes must remain backward-compatible.

## 13. Definition of done

This feature is complete when:

- The product table and generated migration are committed.
- All five authenticated routes are implemented under `apps/shop`.
- Ownership is enforced for every operation.
- Slug generation, regeneration, uniqueness, and conflict behavior are implemented.
- `PUT` performs a complete replacement with required `isActive`.
- Product list pagination follows the existing cursor convention.
- Hard deletion and shop cascade deletion work.
- Route-level integration tests cover the acceptance criteria.
- `AppWithErrors` reflects the product route response types where required.
- No public product endpoints or frontend changes are included.
- Scoped formatting, linting, typechecking, tests, and build validation pass.

## 14. Risks and future considerations

- `priceMinor` has no currency metadata in this feature. A future currency configuration must define the unit consumed by clients before public checkout or financial reporting is implemented.
- Regenerating slugs means a future public product URL can change after a rename. Public catalog work must decide whether to preserve aliases or accept broken historical URLs.
- Hard deletion is appropriate while no order or inventory records reference products. Once transactional records exist, product deletion may need to become archival or be restricted.
- If staff or shop membership roles are introduced, the current owner-only authorization policy must be extended in a separate access-control change.
