'use strict';

// ============================================================
// AI Precision Recall Lab — the cloud copy of the campaign (optional, spec 01 §15.1, 05 §5.1): a Google
// sign-in through Supabase Auth and the prlab_progress table (supabase/schema.sql: a row per Google
// account). Built like the ivan games' cloud saves (lift-logic's core/cloud.js; world-aviation's for many
// careers): one account per device, since the game has one player's campaign.
// Once signed in, the campaign here is merged with the account's copy and sent back (Campaign.merge /
// snapshot): on the sign-in, at start, on every return to the foreground, CLOUD_PUSH_MS after the last
// change and when the page goes to the background. Without signing in nothing changes and no network call
// is made; without lib/supabase.min.js or from file:// (Google cannot send the player back there) the game
// has no cloud and shows none of it.
// Used by game.js (Cloud.init, onChange) and ui/screens.js (the start screen's account row).
// ============================================================

// The project's URL and its publishable key are not secrets: they ship to every visitor in the page either
// way; what guards the rows is the table's row-level security (supabase/schema.sql). The project is the one
// the ivan games (world-aviation, lift-logic) and the swedish app use.
const CLOUD_URL = 'https://achcmqqooszwfwyfndbd.supabase.co';
const CLOUD_KEY = 'sb_publishable_X7gyM9_VkV1Zhw6af8zN2w_flfVmLUN';
const CLOUD_TABLE = 'prlab_progress';
const CLOUD_PUSH_MS = 10000;   // changes are sent this long after the last one

const Cloud = {
  available: false,
  client: null,
  seen: false,         // the client has told whether it holds a session (it reads the stored one at start)
  userId: null,        // the signed-in account, or null
  email: '',
  sync: 'idle',        // how the last sync went: 'syncing' | 'synced' | 'error' | 'idle'
  busy: false,
  again: false,
  timer: null,
  onChange: null,      // something to show changed (and whether the campaign did): game.js redraws

  // the session under the game's own key (prLab.auth), never the library's default
  // sb-<project>-auth-token, which the swedish app on the same origin uses
  get authKey() { return Store.PREFIX + 'auth'; },

  init() {
    if (typeof supabase === 'undefined' || !/^https?:$/.test(location.protocol)) return;
    this.available = true;
    const acct = Store.getJSON('cloud', null);
    if (acct) this.email = acct.email || '';
    // a client only when there is a session to use, or a sign-in on its way back from Google
    let stored = false, verifier = false;
    try {
      stored = !!localStorage.getItem(this.authKey);
      verifier = !!localStorage.getItem(this.authKey + '-code-verifier');
    } catch (e) { /* storage blocked */ }
    const back = new URLSearchParams(location.search).has('code') && verifier;
    if (acct || back || stored) this.start();
    Campaign.onSave = () => this.schedule();
    // back in the foreground: the other devices' progress comes in; going away: what waits is sent
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.timer) this.syncNow(); }
      else this.syncNow();
    });
  },
  start() {
    if (this.client) return this.client;
    // Google's answer (?code=…) is swapped for the session and stripped from the address by the library
    this.client = supabase.createClient(CLOUD_URL, CLOUD_KEY, {
      auth: { flowType: 'pkce', storageKey: this.authKey, detectSessionInUrl: true }
    });
    // fired at once with the stored session, then on every change; the library must not be called back
    // from inside its own callback, hence the timeout
    this.client.auth.onAuthStateChange((event, session) => setTimeout(() => this.authChanged(session), 0));
    return this.client;
  },
  authChanged(session) {
    this.seen = true;
    const uid = session && session.user ? session.user.id : null;
    if (uid && uid !== this.userId) {
      this.userId = uid;
      this.email = session.user.email || '';
      Store.setJSON('cloud', { user: uid, email: this.email });
      this.syncNow();
    } else if (!uid && this.userId) {
      this.userId = null;
      this.sync = 'idle';
    }
    this.changed();
  },
  ready() { return !!(this.client && this.userId); },
  // what to show: 'unavailable', 'off' (never signed in here), 'signedOut' (the session is gone: sign in
  // again), else how the sync goes
  get status() {
    if (!this.available) return 'unavailable';
    if (this.client && !this.seen) return 'syncing';
    if (!this.userId) return Store.getJSON('cloud', null) ? 'signedOut' : 'off';
    return this.sync === 'idle' ? 'syncing' : this.sync;
  },
  changed(campaign) { if (this.onChange) this.onChange(!!campaign); },

  // ---------- signing in and out ----------
  signIn() {
    if (!this.available) return;
    this.start().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
      .then((r) => { if (r && r.error) { this.sync = 'error'; this.changed(); } }, () => { this.sync = 'error'; this.changed(); });
  },
  // the campaign stays on this device; the last changes are sent first
  signOut() {
    if (!this.client) return;
    const c = this.client;
    const last = this.ready() ? this.upsert() : Promise.resolve();
    clearTimeout(this.timer); this.timer = null;
    last.catch(() => {}).then(() => c.auth.signOut({ scope: 'local' })).catch(() => {});
    Store.remove('cloud');
    this.userId = null;
    this.email = '';
    this.sync = 'idle';
    this.changed();
  },

  // ---------- syncing ----------
  schedule() {
    if (!this.ready()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow(), CLOUD_PUSH_MS);
  },
  // the account's copy merged into the campaign here, then the result sent back; a failed request sends
  // nothing over the cloud's copy, and the next change or return to the foreground tries again
  syncNow() {
    if (!this.ready()) return;
    clearTimeout(this.timer); this.timer = null;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    this.sync = 'syncing';
    this.changed();
    const uid = this.userId;
    let campaignChanged = false;
    this.client.from(CLOUD_TABLE).select('data').eq('user_id', uid).maybeSingle().then((r) => {
      if (r.error) throw r.error;
      if (uid !== this.userId) throw new Error('signed out meanwhile');
      if (r.data && r.data.data) campaignChanged = Campaign.merge(r.data.data.campaign);
      return this.upsert();
    }).then(() => {
      if (uid === this.userId) this.sync = 'synced';
    }, () => {
      if (uid === this.userId) this.sync = 'error';
    }).then(() => {
      this.busy = false;
      this.changed(campaignChanged);
      if (this.again) { this.again = false; this.syncNow(); }
    });
  },
  // the campaign up to the account; nothing while this device has none (a fresh device never sends an
  // empty campaign over the account's)
  upsert() {
    if (!Campaign.exists) return Promise.resolve();
    const row = { user_id: this.userId, data: { v: 1, campaign: Campaign.snapshot() }, updated_at: new Date().toISOString() };
    return this.client.from(CLOUD_TABLE).upsert(row).then((r) => { if (r.error) throw r.error; });
  }
};
