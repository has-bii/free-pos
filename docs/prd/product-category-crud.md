# Product Category CRUD

- **Status:** Ready for implementation
- **Scope:** Backend only
- **Target service:** `apps/shop` (`@repo/shop`)
- **Database package:** `packages/database` (`@repo/database`)
- **Primary users:** Authenticated shop owners

## 1. Summary

Add flat, shop-scoped Product Category CRUD to `apps/shop`. Each Product may reference at most one Category, while remaining uncategorized when `categoryId` is `null`.

The feature includes the Category database model and API, plus the Product schema and API changes needed to create, replace, and return a Product category assignment. It does not include frontend work, public category endpoints, or staff permissions.

The implementation must follow the existing `apps/shop` conventions: Hono route modules, `requireAuth`, Valibot validation, repository-based database access, direct JSON responses, and route-level integration tests.

## 2. Goals

1. Allow an authenticated shop owner to create, list, retrieve, rename, and hard-delete categories for their own shop.
2. Generate and maintain a unique, server-owned category slug for future catalog use.
3. Allow each Product to reference one Category or remain uncategorized.
4. Prevent cross-shop category assignment and cross-shop category access.
5. Preserve Products when their Category is deleted by clearing `product.categoryId`.
6. Follow existing Product CRUD response, authentication, validation, error, migration, and testing conventions where they do not conflict with the decisions in this PRD.
7. Add the schema, generated migration, repository code, route handlers, and integration coverage needed for the feature.

## 3. Non-goals

The following are explicitly out of scope:

- Frontend category screens, hooks, queries, or API clients.
- Public category or product-category endpoints.
- Staff roles, memberships, or shop-level permissions beyond the existing owner model.
- Category hierarchies or parent-child relationships.
- Category descriptions, active/inactive state, display ordering, colors, icons, or images.
- Multiple categories per Product.
- Product-category join tables.
- Category search, filtering, or configurable sorting.
- Category pagination in this version.
- Product counts, nested Category objects, or aggregate responses in Product endpoints.
- Slug aliases, redirects, historical slug lookup, or client-provided slugs.
- Product inventory, pricing, ordering, tax, or other unrelated domain changes.

## 4. Users and authorization

### 4.1 Primary user

The primary user is an authenticated owner of a shop managed by `apps/shop`.

### 4.2 Authorization model

All Category routes require `requireAuth` from `@repo/auth-kit`. The authenticated user ID comes from `c.var.userId`.

For every Category operation:

1. Resolve the shop owned by the authenticated user.
2. Return `404` with `Shop not found.` when the user does not have a shop.
3. Scope every Category read, update, and delete by that shop ID.

A Category belonging to another shop must not be exposed. Direct Category detail, update, and delete operations treat a missing or cross-shop Category as `404`.

Product category assignment must also be scoped to the Product's shop. A valid Category UUID that is missing or belongs to another shop is a semantic input error and returns `422` with a field-level `categoryId` error.

## 5. Data model

### 5.1 Category table

Add a `category` table to `packages/database/src/schema.ts`.

| Column | Type | Nullability/default | Rules |
| --- | --- | --- | --- |
| `id` | `varchar(36)` | Primary key | UUIDv7-style ID generated using the repository convention |
| `shopId` | `varchar(36)` | Required | Foreign key to `shop.id`; `onDelete: "cascade"` |
| `name` | `varchar(255)` | Required | Trimmed, non-empty category name |
| `slug` | `varchar(64)` | Required | Server-generated lowercase kebab-case slug |
| `createdAt` | `timestamp` | Required, `defaultNow()` | Creation timestamp |
| `updatedAt` | `timestamp` | Required, `defaultNow().onUpdateNow()` | Last-update timestamp |

Add a unique index on `(shopId, slug)` named according to the repository's database naming convention. Category names are not stored as a separate unique constraint; normalized slug collisions enforce the effective uniqueness rule.

### 5.2 Product relationship

Add the following field to the existing `product` table:

| Column | Type | Nullability/default | Rules |
| --- | --- | --- | --- |
| `categoryId` | `varchar(36)` | Nullable | Foreign key to `category.id`; `onDelete: "set null"` |

Add an index for `product.categoryId` to support category-based lookups and foreign-key operations.

A Product may have exactly one Category or no Category:

```text
product.categoryId = category.id
product.categoryId = null
```

The database foreign key guarantees that a non-null reference points to an existing Category. Application/repository logic must additionally verify that the Category belongs to the same shop as the Product; a simple foreign key alone does not enforce that boundary.

### 5.3 Shop deletion behavior

Deleting a Shop cascades to its Categories and Products:

- `category.shopId` uses `ON DELETE CASCADE`.
- Existing `product.shopId` behavior continues to delete Products with the Shop.
- The `product.categoryId` `ON DELETE SET NULL` behavior applies when a Category is deleted independently; Products are deleted with their Shop during Shop deletion.

## 6. Slug rules

Use the existing slug normalization behavior from `apps/shop/src/lib/slug.ts`:

1. Lowercase the name.
2. Replace runs of non-ASCII-alphanumeric characters with `-`.
3. Trim leading and trailing hyphens.
4. Truncate to the existing 64-character slug limit at a word boundary.
5. Reject a name that produces no usable slug.

Category slugs are generated by the server. Clients must not provide `slug` in create or update bodies.

On category rename, derive a new slug from the new name. If the new slug is already used by another Category in the same Shop:

- Return `409`.
- Leave the existing Category unchanged.
- Do not create aliases or redirects.

A category-specific invalid-name error should preserve the existing public error style, for example `Category name must contain at least one letter or number.`

## 7. Category API surface

Routes are mounted by `apps/shop/src/modules/shop/shop.routes.ts` through a dedicated Category route module.

### 7.1 Create a Category

```http
POST /shops/me/categories
Content-Type: application/json
```

Request body:

```json
{
  "name": "Beverages"
}
```

The body is a strict object. The `name` property is required. The following properties are not accepted from the client:

- `id`
- `shopId`
- `slug`
- `createdAt`
- `updatedAt`
- Any unknown property

Success response:

```http
201 Created
```

```json
{
  "message": "Category created.",
  "data": {
    "id": "0192...",
    "shopId": "0191...",
    "name": "Beverages",
    "slug": "beverages",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

The handler inserts the Category using the authenticated owner's shop ID, reads the created row back, and returns the full Category representation.

### 7.2 List Categories

```http
GET /shops/me/categories
```

The endpoint returns every Category belonging to the authenticated owner's Shop. It has no query parameters, pagination cursor, filtering, or configurable sorting.

Categories are ordered alphabetically by `name` ascending. Use `id` as a stable tie-breaker when names compare equally.

Success response:

```json
{
  "message": "ok",
  "data": [
    {
      "id": "0192...",
      "shopId": "0191...",
      "name": "Beverages",
      "slug": "beverages",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

The API intentionally returns a direct `Category[]` in `data`, rather than the existing paginated `data.data` shape.

### 7.3 Retrieve a Category

```http
GET /shops/me/categories/:id
```

The `id` path parameter must be validated as a UUID before repository access.

Success response:

```json
{
  "message": "ok",
  "data": {
    "id": "0192...",
    "shopId": "0191...",
    "name": "Beverages",
    "slug": "beverages",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

A malformed ID returns `400`. An unknown or cross-shop Category returns `404`.

### 7.4 Rename a Category

```http
PUT /shops/me/categories/:id
Content-Type: application/json
```

Request body:

```json
{
  "name": "Cold Beverages"
}
```

`PUT` is a complete replacement of the Category's mutable fields. Since `name` is currently the only mutable field, it is required.

On success:

```http
200 OK
```

```json
{
  "message": "Category updated.",
  "data": {
    "id": "0192...",
    "shopId": "0191...",
    "name": "Cold Beverages",
    "slug": "cold-beverages",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

A slug conflict must be detected before the existing row is changed, and the update must remain atomic from the caller's perspective.

### 7.5 Delete a Category

```http
DELETE /shops/me/categories/:id
```

Deleting a Category is a hard delete.

If Products reference the Category, the database sets their `categoryId` values to `null`; the Products themselves remain.

Success response:

```http
200 OK
```

```json
{
  "message": "Category deleted."
}
```

A malformed ID returns `400`. An unknown or cross-shop Category returns `404`.

## 8. Product API changes

The existing Product routes remain owner-scoped:

```http
POST /shops/me/products
PUT  /shops/me/products/:id
GET  /shops/me/products
GET  /shops/me/products/:id
```

### 8.1 Product request body

Both Product `POST` and `PUT` bodies must include a `categoryId` property:

```json
{
  "name": "Arabica Coffee",
  "description": "250g bag",
  "priceMinor": 1299,
  "isActive": true,
  "categoryId": "0192..."
}
```

An uncategorized Product explicitly sends `null`:

```json
{
  "name": "Arabica Coffee",
  "description": null,
  "priceMinor": 1299,
  "isActive": true,
  "categoryId": null
}
```

`categoryId` is required in the request shape but nullable in value. Product `PUT` remains a complete replacement.

The Product body must continue to reject unknown properties. Category IDs are server-owned references; clients cannot submit a Category object or category slug in place of `categoryId`.

### 8.2 Product category validation

Validation occurs in two stages:

1. Schema validation:
   - Missing `categoryId` returns `400`.
   - A non-null malformed UUID returns `400` with the existing validation error shape.
   - `null` is valid.
2. Shop-scoped resource validation:
   - A well-formed UUID that does not resolve to a Category in the Product's Shop returns `422`.
   - The response includes a field-level error:

```json
{
  "message": "Validation failed.",
  "error": {
    "categoryId": {
      "message": "Category not found."
    }
  }
}
```

The handler must validate the Category before inserting or updating the Product. A Category from another Shop must never be assigned.

### 8.3 Product responses

Product create, detail, list, and update responses expose the scalar `categoryId` field:

```json
{
  "id": "0193...",
  "shopId": "0191...",
  "categoryId": "0192...",
  "name": "Arabica Coffee",
  "slug": "arabica-coffee",
  "description": "250g bag",
  "priceMinor": 1299,
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

When uncategorized, `categoryId` is `null`. Do not include a nested Category object or category aggregate data.

## 9. Validation and error behavior

Use the existing `apps/shop` validation middleware and response conventions.

| Situation | Status | Expected behavior |
| --- | ---: | --- |
| Missing/invalid auth | `401` | `requireAuth` rejects the request |
| Authenticated user has no Shop | `404` | Return `Shop not found.` |
| Malformed Category path ID | `400` | Existing validation error shape |
| Malformed Product `categoryId` | `400` | Field-level schema validation error |
| Missing Product `categoryId` | `400` | Required-body validation error |
| Empty/too-long Category name | `400` | Field-level schema validation error |
| Category name produces no slug | `422` | Category-name domain validation error |
| Missing/cross-shop Category in direct Category route | `404` | Do not reveal another Shop's resource |
| Missing/cross-shop Category in Product write | `422` | Field-level `categoryId` semantic error |
| Duplicate Category slug within a Shop | `409` | Existing Category remains unchanged |
| Successful Category create | `201` | Return full Category in direct `data` |
| Successful Category list/detail/update/delete | `200` | Follow the response shapes in this PRD |

Unexpected database or application failures continue to use the existing global `500` handling. Raw database errors must not be exposed.

## 10. Backend structure

Follow the existing backend conventions. The expected implementation surface is:

```text
packages/database/src/schema.ts
packages/database/drizzle/<generated-migration>.sql
packages/database/drizzle/meta/<generated-snapshot>.json
packages/database/drizzle/meta/_journal.json

apps/shop/src/errors.ts
apps/shop/src/lib/slug.ts
apps/shop/src/repositories/category.repository.ts
apps/shop/src/repositories/product.repository.ts
apps/shop/src/modules/category/category.routes.ts
apps/shop/src/modules/category/category.handlers.ts
apps/shop/src/modules/category/category.schema.ts
apps/shop/src/modules/shop/shop.routes.ts
apps/shop/src/modules/product/product.schema.ts
apps/shop/src/modules/product/product.handlers.ts
apps/shop/test/routes/category.test.ts
apps/shop/test/routes/product.test.ts
```

No service layer is required for the basic Category operations. A service should be introduced only if implementation requires multi-repository orchestration or an explicit transaction boundary.

### 10.1 Category repository responsibilities

`CategoryRepository` is the only application layer that imports the `category` table from `@repo/database`.

It should expose methods sufficient for:

- Finding a Category by ID within a Shop.
- Listing all Categories for a Shop in name/id order.
- Inserting a Category.
- Updating a Category's name and slug within a Shop.
- Deleting a Category within a Shop.

Methods accept `DatabaseExecutor` so they work with the existing database and transaction types.

The repository must:

- Scope every operation by `shopId`.
- Normalize the compound unique-index violation into a typed Category slug error.
- Avoid leaking raw driver errors.
- Preserve the existing row when an update encounters a slug conflict.

### 10.2 Product repository and handler responsibilities

Update the existing Product repository methods to persist `categoryId` on insert and update and return it from normal Product queries.

Product handlers may resolve the authenticated Shop and validate the Category reference before calling the Product repository. They must not import Drizzle table definitions or execute raw queries.

## 11. Acceptance criteria and tests

Add route-level integration tests using the existing Worker test setup and test database conventions.

### 11.1 Category authentication and ownership

- Unauthenticated requests to all five Category routes return `401`.
- An authenticated user without a Shop receives `404`.
- An owner can access only Categories belonging to their own Shop.
- A Category belonging to another Shop returns `404` for detail, update, and delete.

### 11.2 Category create and validation

- A valid Category is created with a generated slug and full response representation.
- `name` is trimmed before persistence.
- Missing, empty, whitespace-only, and overlong names are rejected with `400`.
- A name with no usable alphanumeric content returns `422`.
- Client-provided `slug`, IDs, timestamps, and unknown fields are rejected.
- A duplicate normalized slug returns `409`.

### 11.3 Category list and detail

- The list returns every Category for the authenticated Shop.
- The list response is `{ message, data: Category[] }`.
- Results are sorted by `name` ascending, with a stable ID tie-breaker.
- No Category from another Shop appears in the list.
- Detail returns a direct `data: Category` response.
- Malformed IDs return `400`; unknown IDs return `404`.

### 11.4 Category update

- `PUT` requires the strict `{ name }` body.
- Renaming a Category regenerates its slug.
- A conflicting regenerated slug returns `409`.
- A failed conflict update leaves the original name and slug unchanged.
- A successful update returns the complete updated Category in direct `data`.

### 11.5 Category delete and lifecycle

- An owner can hard-delete a Category and receives the delete message.
- A deleted Category can no longer be retrieved.
- Products assigned to the deleted Category remain in the database with `categoryId = null`.
- Deleting a Shop cascades to its Categories and Products.
- Deleting or accessing a missing/cross-shop Category returns `404`.

### 11.6 Product integration

- Product create and update require `categoryId` in the request body.
- `categoryId: null` succeeds and creates or leaves an uncategorized Product.
- A valid same-shop Category ID succeeds.
- A malformed Category ID returns `400`.
- A valid missing or cross-shop Category ID returns `422` with an `error.categoryId` field.
- Product create, list, detail, and update responses include only the scalar `categoryId`.
- Existing Product fields and ownership behavior continue to work.

### 11.7 Regression coverage

- Existing Shop and Product tests continue to pass after the schema and Product body changes.
- The test database has the generated migration applied before route tests run.
- No external provider or network calls are introduced.

## 12. Migration and rollout

1. Add `category` and `product.categoryId` to `packages/database/src/schema.ts`.
2. Ensure existing Product rows receive `NULL` for the new nullable field.
3. Generate the migration with `pnpm db:generate`; do not hand-edit generated migration files.
4. Apply the migration to the test database.
5. Run Category and updated Product integration tests.
6. Apply the production database migration before deploying the updated `apps/shop` Worker.
7. Deploy the Worker after the schema is available.

The migration is additive and does not require a Product backfill because uncategorized Products are valid. The Product request contract change is intentional and must be reflected in any future clients.

## 13. Definition of done

This feature is complete when:

- The `category` table, indexes, foreign keys, and generated migration are committed.
- `product.categoryId` is nullable, indexed, and uses `ON DELETE SET NULL`.
- All five authenticated Category routes are implemented.
- Category ownership is enforced on every operation.
- Category validation, slug generation, uniqueness, and conflict behavior are implemented.
- Category lists use the direct unpaginated `data: Category[]` response and alphabetical ordering.
- Product create/update require nullable `categoryId` and enforce same-shop assignment.
- Product responses include `categoryId` without nested Category data.
- Category deletion preserves Products and clears their assignments.
- Shop deletion cascades correctly.
- Route-level integration tests cover the acceptance criteria and regression behavior.
- Scoped formatting, linting, typechecking, tests, and build validation pass.
- No frontend changes or public category endpoints are included.

## 14. Risks and future considerations

- Unpaginated category lists are intentionally limited to the expected small category collection. Cursor pagination should be introduced if category counts grow materially.
- Requiring `categoryId` in existing Product `POST` and `PUT` bodies is an intentional API contract change. Any future frontend or external client must send either a valid same-shop Category ID or `null`.
- Product-category assignment is one-to-one by design. Supporting multiple categories later would require a migration to a join table and a new API contract.
- Public category URLs may use the stored slug in a future public-catalog feature, but that feature must define slug history, visibility, and caching separately.
- Staff permissions, category ordering, active state, and richer category metadata should be separate features rather than implicit additions to this implementation.
