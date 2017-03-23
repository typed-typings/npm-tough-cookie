/**
 * Parse a cookie date string into a Date. Parses according to RFC6265
 * Section 5.1.1, not Date.parse().
 */
export function parseDate (date: string): Date;

/**
 * Format a Date into a RFC1123 string (the RFC6265-recommended format).
 */
export function formatDate (date: Date): string;

/**
 * Transforms a domain-name into a canonical domain-name. The canonical domain-name
 * is a trimmed, lowercased, stripped-of-leading-dot and optionally punycode-encoded
 * domain-name (Section 5.1.2 of RFC6265). For the most part, this function is
 * idempotent (can be run again on its output without ill effects).
 */
export function canonicalDomain (domain: string): string;

/**
 * Answers "does this real domain match the domain in a cookie?". The str is the
 * "current" domain-name and the domStr is the "cookie" domain-name. Matches
 * according to RFC6265 Section 5.1.3, but it helps to think of it as a "suffix match".
 *
 * The canonicalize parameter will run the other two paramters through canonicalDomain or not.
 */
export function domainMatch (str: string, domStr: string, canonicalize?: boolean): boolean;

/**
 * Given a current request/response path, gives the Path apropriate for storing in
 * a cookie. This is basically the "directory" of a "file" in the path, but is
 * specified by Section 5.1.4 of the RFC.
 *
 * The path parameter MUST be only the pathname part of a URI (i.e. excludes the hostname,
 * query, fragment, etc.). This is the .pathname property of node's uri.parse() output.
 */
export function defaultPath (path: string): string;

/**
 * Answers "does the request-path path-match a given cookie-path?" as
 * per RFC6265 Section 5.1.4. Returns a boolean.
 *
 * This is essentially a prefix-match where cookiePath is a prefix of reqPath.
 */
export function pathMatch (reqPath: string, cookiePath: string): boolean;

/**
 * alias for Cookie.parse(cookieString[, options])
 */
export function parse (cookieString: string, options?: CookieParseOptions): Cookie;

/**
 * alias for Cookie.fromJSON(string)
 */
export function fromJSON (json: string): Cookie;

/**
 * Returns the public suffix of this hostname. The public suffix is the shortest
 * domain-name upon which a cookie can be set. Returns null if the hostname cannot
 * have cookies set for it.
 *
 * For example: www.example.com and www.subdomain.example.com both have public suffix example.com.
 *
 * For further information, see http://publicsuffix.org/. This module derives its list from that site.
 */
export function getPublicSuffix (hostname: string): string;

/**
 * For use with .sort(), sorts a list of cookies into the recommended order
 * given in the RFC (Section 5.4 step 2). The sort algorithm is, in order of precedence:

 * - Longest .path
 * - oldest .creation (which has a 1ms precision, same as Date)
 * - lowest .creationIndex (to get beyond the 1ms precision)
 *
 * ```
 * var cookies = [ \/* unsorted array of Cookie objects *\/ ];
 * cookies = cookies.sort(cookieCompare);
 * ```
 *
 * Note: Since JavaScript's Date is limited to a 1ms precision, cookies within
 * the same milisecond are entirely possible. This is especially true when using
 * the now option to .setCookie(). The .creationIndex property is a per-process
 * global counter, assigned during construction with new Cookie(). This preserves
 * the spirit of the RFC sorting: older cookies go first. This works great for
 * MemoryCookieStore, since Set-Cookie headers are parsed in order, but may not
 * be so great for distributed systems. Sophisticated Stores may wish to set this
 * to some other logical clock such that if cookies A and B are created in the
 * same millisecond, but cookie A is created before cookie B, then
 * A.creationIndex < B.creationIndex. If you want to alter the global counter,
 * which you probably shouldn't do, it's stored in Cookie.cookiesCreated.
 */
export function cookieCompare (a: Cookie, b: Cookie): number;

/**
 * Generates a list of all possible domains that domainMatch() the parameter.
 * May be handy for implementing cookie stores.
 */
export function permuteDomain (domain: string): string[];

/**
 * Generates a list of all possible paths that pathMatch() the parameter.
 * May be handy for implementing cookie stores.
 */
export function permutePath (path: string): string[];

/**
 * Base class for CookieJar stores. Available as tough.Store.
 */
export class Store {
  /**
   * Retrieve a cookie with the given domain, path and key (a.k.a. name).
   * The RFC maintains that exactly one of these cookies should exist in a store. If the store is using versioning,
   * this means that the latest/newest such cookie should be returned.
   *
   * Callback takes an error and the resulting Cookie object.
   * If no cookie is found then null MUST be passed instead (i.e. not an error).
   */
  findCookie (domain: string, path: string, key: string, cb: (error: Error, cookie: Cookie) => any): any;

  /**
   * Locates cookies matching the given domain and path. This is most often called in the context of
   * cookiejar.getCookies() above.
   *
   * If no cookies are found, the callback MUST be passed an empty array.
   *
   * The resulting list will be checked for applicability to the current request according to the RFC (domain-match,
   * path-match, http-only-flag, secure-flag, expiry, etc.), so it's OK to use an optimistic search algorithm when
   * implementing this method. However, the search algorithm used SHOULD try to find cookies that domainMatch()
   * the domain and pathMatch() the path in order to limit the amount of checking that needs to be done.
   *
   * As of version 0.9.12, the allPaths option to cookiejar.getCookies() above will cause the path here to be null.
   * If the path is null, path-matching MUST NOT be performed (i.e. domain-matching only).
   */
  findCookies (domain: string, path: string, cb: (error: Error, cookies: Cookie[]) => any): void;

  /**
   * Adds a new cookie to the store. The implementation SHOULD replace any existing cookie with the same .domain,
   * .path, and .key properties -- depending on the nature of the implementation, it's possible that between the call
   * to fetchCookie and putCookie that a duplicate putCookie can occur.
   *
   * The cookie object MUST NOT be modified; the caller will have already updated the .creation and .lastAccessed
   * properties.
   *
   * Pass an error if the cookie cannot be stored.
   */
  putCookie (cookie: Cookie, cb: (error: Error) => any): void;

  /**
   * Update an existing cookie. The implementation MUST update the .value for a cookie with the same domain, .path
   * and .key. The implementation SHOULD check that the old value in the store is equivalent to oldCookie - how
   * the conflict is resolved is up to the store.
   *
   * The .lastAccessed property will always be different between the two objects (to the precision possible via
   * JavaScript's clock). Both .creation and .creationIndex are guaranteed to be the same. Stores MAY ignore or
   * defer the .lastAccessed change at the cost of affecting how cookies are selected for automatic deletion
   * (e.g., least-recently-used, which is up to the store to implement).
   *
   * Stores may wish to optimize changing the .value of the cookie in the store versus storing a new cookie.
   * If the implementation doesn't define this method a stub that calls putCookie(newCookie,cb) will be added to
   * the store object.
   *
   * The newCookie and oldCookie objects MUST NOT be modified.
   *
   * Pass an error if the newCookie cannot be stored.
   */
  updateCookie (oldCookie: Cookie, newCookie: Cookie, cb: (error: Error) => any): void;

  /**
   * Remove a cookie from the store (see notes on findCookie about the uniqueness constraint).
   *
   * The implementation MUST NOT pass an error if the cookie doesn't exist; only pass an error due to the failure
   * to remove an existing cookie.
   */
  removeCookie (domain: string, path: string, key: string, cb: (error: Error) => any): void;

  /**
   * Removes matching cookies from the store. The path parameter is optional, and if missing means all paths in
   * a domain should be removed.
   *
   * Pass an error ONLY if removing any existing cookies failed.
   */
  removeCookies (domain: string, path: string, cb: (error: Error) => any): any;

  /**
   * Produces an Array of all cookies during jar.serialize(). The items in the array can be true Cookie objects or
   * generic Objects with the [Serialization Format] data structure.
   *
   * Cookies SHOULD be returned in creation order to preserve sorting via compareCookies(). For reference,
   * MemoryCookieStore will sort by .creationIndex since it uses true Cookie objects internally. If you don't
   * return the cookies in creation order, they'll still be sorted by creation time, but this only has a precision
   * of 1ms. See compareCookies for more detail.
   *
   * Pass an error if retrieval fails.
   */
  getAllCookies (cb: (error: Error, cookies: Cookie[]) => any): void;
}

/**
 * A just-in-memory CookieJar synchronous store implementation, used by default.
 * Despite being a synchronous implementation, it's usable with both the
 * synchronous and asynchronous forms of the CookieJar API.
 */
export class MemoryCookieStore extends Store {}

/**
 * Exported via tough.Cookie.
 */
export class Cookie {
  /**
   * Parses a single Cookie or Set-Cookie HTTP header into a Cookie object. Returns
   * undefined if the string can't be parsed.
   *
   * The options parameter is not required and currently has only one property:
   *
   * - loose - boolean - if true enable parsing of key-less cookies like =abc and =, which are not RFC-compliant.
   * If options is not an object, it is ignored, which means you can use Array#map with it.
   *
   * Here's how to process the Set-Cookie header(s) on a node HTTP/HTTPS response:
   *
   * ```
   * if (res.headers['set-cookie'] instanceof Array)
   *   cookies = res.headers['set-cookie'].map(Cookie.parse);
   * else
   *   cookies = [Cookie.parse(res.headers['set-cookie'])];
   * ```
   */
  static parse (cookieString: string, options?: CookieParseOptions): Cookie;

  /**
   * the name or key of the cookie (default "")
   */
  key: string;

  /**
   * the value of the cookie (default "")
   */
  value: string;

  /**
   * if set, the Expires= attribute of the cookie (defaults to the string "Infinity").
   * See setExpires()
   */
  expires: Date;

  /**
   * (seconds) if set, the Max-Age= attribute in seconds of the cookie. May also
   * be set to strings "Infinity" and "-Infinity" for non-expiry and immediate-expiry,
   * respectively. See setMaxAge()
   */
  maxAge: number;

  /**
   * the Domain= attribute of the cookie
   */
  domain: string;

  /**
   * the Path= of the cookie
   */
  path: string;

  /**
   * the Secure cookie flag
   */
  secure: boolean;

  /**
   * the HttpOnly cookie flag
   */
  httpOnly: boolean;

  /**
   * any unrecognized cookie attributes as strings (even if equal-signs inside)
   */
  extensions: string[];

  /**
   * when this cookie was constructed
   */
  creation: Date;

  /**
   * set at construction, used to provide greater sort precision
   * (please see cookieCompare(a,b) for a full explanation)
   */
  creationIndex: number;

  /**
   * is this a host-only cookie (i.e. no Domain field was set, but was instead implied)
   */
  hostOnly: boolean;

  /**
   * if true, there was no Path field on the cookie and defaultPath() was used to derive one.
   */
  pathIsDefault: boolean;

  /**
   * last time the cookie got accessed. Will affect cookie cleaning once
   * implemented. Using cookiejar.getCookies(...) will update this attribute.
   */
  lastAccessed: Date;

  /**
   * encode to a Set-Cookie header value. The Expires cookie field is set
   * using formatDate(), but is omitted entirely if .expires is Infinity.
   */
  toString (): string;

  /**
   * encode to a Cookie header value (i.e. the .key and .value properties joined with '=').
   */
  cookieString (): string;

  /**
   * Receives an options object that can contain any of the above Cookie properties, uses the
   * default for unspecified properties.
   */
  constructor (options?: Partial<Cookie>);

  /**
   * sets the expiry based on a date-string passed through parseDate(). If parseDate
   * returns null (i.e. can't parse this date string), .expires is set to "Infinity" (a string) is set.
   */
  setExpires (expires: string): void;

  /**
   * sets the maxAge in seconds. Coerces -Infinity to "-Infinity" and
   * Infinity to "Infinity" so it JSON serializes correctly.
   */
  setMaxAge (maxAge: number): void;

  /**
   * expiryTime() Computes the absolute unix-epoch milliseconds that this cookie
   * expires. expiryDate() works similarly, except it returns a Date object. Note
   * that in both cases the now parameter should be milliseconds.
   *
   * Max-Age takes precedence over Expires (as per the RFC). The .creation
   * attribute -- or, by default, the now paramter -- is used to offset the .maxAge attribute.
   *
   * If Expires (.expires) is set, that's returned.
   *
   * Otherwise, expiryTime() returns Infinity and expiryDate() returns a Date
   * object for "Tue, 19 Jan 2038 03:14:07 GMT" (latest date that can be
   * expressed by a 32-bit time_t; the common limit for most user-agents).
   */
  expiryTime (now?: number): number;
  expiryDate (now?: number): Date;

  /**
   * compute the TTL relative to now (milliseconds). The same precedence rules
   * as for expiryTime/expiryDate apply.
   *
   * The "number" Infinity is returned for cookies without an explicit
   * expiry and 0 is returned if the cookie is expired. Otherwise a time-to-live
   * in milliseconds is returned.
   */
  TTL (now?: number): number;

  /**
   * return the canonicalized .domain field. This is lower-cased and punycode
   * (RFC3490) encoded if the domain has any non-ASCII characters.
   */
  cdomain (): string;
  canonicalizedDomain (): string;

  /**
   * For convenience in using JSON.serialize(cookie). Returns a plain-old Object that can be JSON-serialized.
   *
   * Any Date properties (i.e., .expires, .creation, and .lastAccessed) are
   * exported in ISO format (.toISOString()).
   *
   * NOTE: Custom Cookie properties will be discarded. In tough-cookie 1.x, since
   * there was no .toJSON method explicitly defined, all enumerable properties were
   * captured. If you want a property to be serialized, add the property name to
   * the Cookie.serializableProperties Array.
   */
  toJSON (): Object;

  /**
   * Does the reverse of cookie.toJSON(). If passed a string, will JSON.parse() that first.
   *
   * Any Date properties (i.e., .expires, .creation, and .lastAccessed) are parsed
   * via Date.parse(), not the tough-cookie parseDate, since it's JavaScript/JSON-y
   * timestamps being handled at this layer.
   *
   * Returns null upon JSON parsing error.
   */
  static fromJSON (json: string): Cookie;

  /**
   * Does a deep clone of this cookie, exactly implemented as Cookie.fromJSON(cookie.toJSON()).
   */
  clone (): Cookie;

  /**
   * Status: IN PROGRESS. Works for a few things, but is by no means comprehensive.
   *
   * validates cookie attributes for semantic correctness. Useful for "lint" checking any Set-Cookie headers you
   * generate. For now, it returns a boolean, but eventually could return a reason string -- you can future-proof with
   * this construct:
   * ```
   * if (cookie.validate() === true) {
   *   // it's tasty
   * } else {
   *   // yuck!
   * }
   * ```
   */
  validate (): boolean;
}

export interface CookieParseOptions {
  loose: boolean;
}

export interface SetCookieOptions {
  /**
   * default true - indicates if this is an HTTP or non-HTTP API. Affects HttpOnly cookies.
   */
  http?: boolean;

  /**
   * autodetect from url - indicates if this is a "Secure" API. If the currentUrl
   * starts with https: or wss: then this is defaulted to true, otherwise false.
   */
  secure?: boolean;

  /**
   * default new Date() - what to use for the creation/access time of cookies
   */
  now?: Date;

  /**
   * default false - silently ignore things like parse errors and invalid
   * domains. Store errors aren't ignored by this option.
   */
  ignoreError?: boolean;
}

export interface GetCookieOptions {
  /**
   * default true - indicates if this is an HTTP or non-HTTP API. Affects HttpOnly cookies.
   */
  http?: boolean;

  /**
   * autodetect from url - indicates if this is a "Secure" API. If the currentUrl
   * starts with https: or wss: then this is defaulted to true, otherwise false.
   */
  secure?: boolean;

  /**
   * default new Date() - what to use for the creation/access time of cookies
   */
  now?: Date;

  /**
   * default true - perform expiry-time checking of cookies and asynchronously
   * remove expired cookies from the store. Using false will return expired cookies
   * and not remove them from the store (which is useful for replaying Set-Cookie headers, potentially).
   */
  expire?: boolean;

  /**
   * default false - if true, do not scope cookies by path. The default uses
   * RFC-compliant path scoping. Note: may not be supported by the underlying
   * store (the default MemoryCookieStore supports it).
   */
  allPaths?: boolean;
}

export interface CookieJarConstructorOptions {
  /**
   * default true - reject cookies with domains like "com" and "co.uk"
   */
  rejectPublicSuffixes?: boolean;

  /**
   * default false - accept malformed cookies like bar and =bar, which have an
   * implied empty name. This is not in the standard, but is used sometimes
   * on the web and is accepted by (most) browsers.
   */
  looseMode?: boolean;
}

/**
 * Simply use new CookieJar(). If you'd like to use a custom store, pass that
 * to the constructor otherwise a MemoryCookieStore will be created and used.
 */
export class CookieJar {
  store: Store;
  enableLooseMode: boolean;
  rejectPublicSuffixes: boolean;

  constructor (store?: Store, options?: boolean | CookieJarConstructorOptions);

  /**
   * Attempt to set the cookie in the cookie jar. If the operation fails, an
   * error will be given to the callback cb, otherwise the cookie is passed
   * through. The cookie will have updated .creation, .lastAccessed and .hostOnly properties.
   */
  setCookie (cookieOrString: string | Cookie, currentUrl: string, cb: (err: Error, cookie?: Cookie) => any): void;
  setCookie (cookieOrString: string | Cookie, currentUrl: string, options: SetCookieOptions, cb: (err: Error, cookie?: Cookie) => any): void;

  /**
   * Synchronous version of setCookie; only works with synchronous stores
   * (e.g. the default MemoryCookieStore).
   */
  setCookieSync (cookieOrString: string | Cookie, currentUrl: string, options?: SetCookieOptions): Cookie;

  /**
   * Retrieve the list of cookies that can be sent in a Cookie header for the current url.
   *
   * If an error is encountered, that's passed as err to the callback, otherwise
   * an Array of Cookie objects is passed. The array is sorted with cookieCompare()
   * unless the {sort:false} option is given.
   */
  getCookies (currentUrl: string, cb: (err: Error, cookies?: Cookie[]) => any): void;
  getCookies (currentUrl: string, options: GetCookieOptions, cb: (err: Error, cookies?: Cookie[]) => any): void;

  /**
   * Synchronous version of getCookies; only works with synchronous stores
   * (e.g. the default MemoryCookieStore).
   */
  getCookiesSync (currentUrl: string, options?: GetCookieOptions): Cookie[];

  /**
   * Accepts the same options as .getCookies() but passes a string suitable
   * for a Cookie header rather than an array to the callback. Simply maps the
   * Cookie array via .cookieString().
   */
  getCookieString (currentUrl: string, cb: (err: Error, cookies?: string) => any): void;
  getCookieString (currentUrl: string, options: GetCookieOptions, cb: (err: Error, cookies?: string) => any): void;

  /**
   * Synchronous version of getCookieString; only works with synchronous stores
   * (e.g. the default MemoryCookieStore).
   */
  getCookieStringSync (currentUrl: string, options?: GetCookieOptions): string;

  /**
   * Returns an array of strings suitable for Set-Cookie headers. Accepts the same options as .getCookies().
   * Simply maps the cookie array via .toString().
   */
  getSetCookieStrings (currentUrl: string, cb: (err: Error, cookies?: string[]) => any): void;
  getSetCookieStrings (currentUrl: string, options: GetCookieOptions, cb: (err: Error, cookies?: string[]) => any): void;

  /**
   * Synchronous version of getSetCookieStrings; only works with synchronous stores
   * (e.g. the default MemoryCookieStore).
   */
  getSetCookieStringsSync (currentUrl: string, options?: GetCookieOptions): string[];

  /**
   * Serialize the Jar if the underlying store supports .getAllCookies.
   *
   * NOTE: Custom Cookie properties will be discarded. If you want a property
   * to be serialized, add the property name to the Cookie.serializableProperties Array.
   *
   * See [Serialization Format].
   */
  serialize (cb: (error: Error, serializedObject: Object) => any): void;

  /**
   * Sync version of .serialize
   */
  serializeSync (): Object;

  /**
   * Alias of .serializeSync() for the convenience of JSON.stringify(cookiejar).
   */
  toJSON (): Object;

  /**
   * A new Jar is created and the serialized Cookies are added to the
   * underlying store. Each Cookie is added via store.putCookie in the order
   * in which they appear in the serialization.
   *
   * The store argument is optional, but should be an instance of Store. By
   * default, a new instance of MemoryCookieStore is created.
   *
   * As a convenience, if serialized is a string, it is passed through
   * JSON.parse first. If that throws an error, this is passed to the callback.
   */
  static deserialize (serialized: string | Object, cb: (error: Error, object: Object) =>any): CookieJar;
  static deserialize (serialized: string | Object, store: Store, cb: (error: Error, object: Object) => any): CookieJar;

  /**
   * Sync version of .deserialize. Note that the store must be synchronous
   * for this to work.
   */
  static deserializeSync (serialized: string | Object, store: Store): Object;

  /**
   * Alias of .deserializeSync to provide consistency with Cookie.fromJSON().
   */
  static fromJSON (string: string): Object;

  /**
   * Produces a deep clone of this jar. Modifications to the original won't
   * affect the clone, and vice versa.
   *
   * The store argument is optional, but should be an instance of Store. By
   * default, a new instance of MemoryCookieStore is created. Transferring
   * between store types is supported so long as the source implements
   * .getAllCookies() and the destination implements .putCookie().
   */
  clone (cb: (error: Error, newJar: CookieJar) => any): void;
  clone (store: Store, cb: (error: Error, newJar: CookieJar) => any): void;

  /**
   * Synchronous version of .clone, returning a new CookieJar instance.
   *
   * The store argument is optional, but must be a synchronous Store instance
   * if specified. If not passed, a new instance of MemoryCookieStore is used.
   *
   * The source and destination must both be synchronous Stores. If one or both
   * stores are asynchronous, use .clone instead. Recall that MemoryCookieStore
   * supports both synchronous and asynchronous API calls.
   */
  cloneSync (store?: Store): CookieJar;
}
