/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiRequests from "../aiRequests.js";
import type * as analytics from "../analytics.js";
import type * as annotations from "../annotations.js";
import type * as brandGuidelines from "../brandGuidelines.js";
import type * as comments from "../comments.js";
import type * as debug from "../debug.js";
import type * as diagnostics from "../diagnostics.js";
import type * as fileUpload from "../fileUpload.js";
import type * as invitations from "../invitations.js";
import type * as kanban from "../kanban.js";
import type * as migrations from "../migrations.js";
import type * as organizations from "../organizations.js";
import type * as scripts from "../scripts.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiRequests: typeof aiRequests;
  analytics: typeof analytics;
  annotations: typeof annotations;
  brandGuidelines: typeof brandGuidelines;
  comments: typeof comments;
  debug: typeof debug;
  diagnostics: typeof diagnostics;
  fileUpload: typeof fileUpload;
  invitations: typeof invitations;
  kanban: typeof kanban;
  migrations: typeof migrations;
  organizations: typeof organizations;
  scripts: typeof scripts;
  templates: typeof templates;
  users: typeof users;
  versions: typeof versions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
