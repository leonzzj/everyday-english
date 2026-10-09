/* Shared app state. */
import { Prefs } from './store.js';

export const S = {
  view: 'today', parts: [],
  issue: null,          // latest issue (Today)
  newsIssue: null,      // issue shown in News (may be an archived one)
  level: Prefs.level,   // 'c1' | 'b2'
  speakTab: 'daily', listenTab: 'pods', upFilter: '全部', resFilter: 'All',
  paste: ''
};

export function storyHref(date, id) { return `#/news/${date}/${id}`; }
