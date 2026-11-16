import * as albums from "./albums";
import * as messaging from "./messaging";
import * as continuity from "./continuity";
import * as growth from "./growth";
import * as commerce from "./commerce";
import * as hardening from "./hardening";

/** Per-lane catalogs, merged after the core catalog. A key may appear in only one. */
export const laneCatalogs = { albums, messaging, continuity, growth, commerce, hardening };
