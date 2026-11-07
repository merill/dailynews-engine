'use strict';

// The Admin.News daily network: every daily edition, in the order the network
// lists them, with Admin.News itself as home. The network bar above each
// site's header and the editions row in its footer read this list, so every
// daily site switches to every other like tabs.
//
// Adding a daily edition is one entry here and an engine release; each site
// picks it up when it moves to that tag. admin.news keeps the same list in
// src/network.js, and the two must be changed together.

const HOME = { name: 'Admin.News', url: 'https://admin.news' };

const EDITIONS = [
  { key: 'entra', label: 'Entra', name: 'Daily Entra News', url: 'https://daily.entra.news' },
  { key: 'intune', label: 'Intune', name: 'Daily Intune News', url: 'https://daily.intune.admin.news' },
  { key: 'defender', label: 'Defender', name: 'Daily Defender News', url: 'https://daily.defender.admin.news' },
  { key: 'security', label: 'Security', name: 'Daily Security News', url: 'https://daily.security.admin.news' },
  { key: 'purview', label: 'Purview', name: 'Daily Purview News', url: 'https://daily.purview.admin.news' },
  { key: 'exchange', label: 'Exchange', name: 'Daily Exchange News', url: 'https://daily.exchange.admin.news' },
  { key: 'sharepoint', label: 'SharePoint', name: 'Daily SharePoint News', url: 'https://daily.sharepoint.admin.news' },
  { key: 'teams', label: 'Teams', name: 'Daily Teams News', url: 'https://daily.teams.admin.news' },
  { key: 'windows-server', label: 'Windows Server', name: 'Daily Windows Server News', url: 'https://daily.windowsserver.admin.news' }
];

const hostOf = url => new URL(url).host;

function currentEdition(host) {
  return EDITIONS.find(edition => hostOf(edition.url) === host) || null;
}

function editionLink(edition, current, className) {
  const isCurrent = current && current.key === edition.key;
  return `<a class="${className}" href="${isCurrent ? '/' : `${edition.url}/`}" title="${edition.name}"${isCurrent ? ' aria-current="page"' : ''}>${edition.label}</a>`;
}

// A thin strip above the site header. It scrolls away with the page so the
// site's own sticky header keeps the top of the viewport; on a phone it scrolls
// sideways, and the inline script brings the current edition into view.
function networkBar(host) {
  const current = currentEdition(host);
  return `<nav class="network-bar" aria-label="Admin.News daily editions"><div class="network-bar-inner"><a class="network-home" href="${HOME.url}/">${HOME.name}</a><span class="network-label" aria-hidden="true">Daily</span><div class="network-editions" data-network-editions>${EDITIONS.map(edition => editionLink(edition, current, 'network-edition')).join('')}</div></div></nav><script>(function(){var s=document.querySelector('[data-network-editions]'),c=s&&s.querySelector('[aria-current]');if(c&&s.scrollWidth>s.clientWidth)s.scrollLeft=c.offsetLeft-s.offsetLeft-(s.clientWidth-c.offsetWidth)/2})()</script>`;
}

// The same switch at the foot of every page, for readers who reach the end.
function networkFooter(host) {
  const current = currentEdition(host);
  return `<nav class="network-footer" aria-label="Admin.News daily editions"><a class="network-footer-home" href="${HOME.url}/">${HOME.name}</a><span class="network-footer-label">Daily editions</span>${EDITIONS.map(edition => editionLink(edition, current, 'network-footer-edition')).join('')}</nav>`;
}

const NETWORK_CSS = `.network-bar{background:#11181d;color:#c9d3cf;font-family:var(--sans);font-size:13px;line-height:1;border-bottom:1px solid #000}.network-bar-inner{max-width:1420px;margin:0 auto;padding:0 24px;height:34px;display:flex;align-items:stretch;gap:18px}.network-home{display:flex;align-items:center;color:#fff;font-family:var(--serif);font-weight:700;font-size:14px;letter-spacing:.01em;text-decoration:none;white-space:nowrap;padding-right:18px;border-right:1px solid #33403b}.network-home:hover{color:#8fe0bd}.network-label{display:flex;align-items:center;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#7f8c87}.network-editions{display:flex;align-items:stretch;gap:2px;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 28px),transparent);padding:0 28px 0 14px;margin-left:-14px}.network-editions::-webkit-scrollbar{display:none}.network-edition{display:flex;align-items:center;padding:0 10px;color:#c9d3cf;text-decoration:none;white-space:nowrap;border-bottom:2px solid transparent;border-top:2px solid transparent}.network-edition:hover{color:#fff;background:#1b2529}.network-edition[aria-current="page"]{color:#8fe0bd;border-bottom-color:#8fe0bd;font-weight:650}.network-edition:focus-visible,.network-home:focus-visible,.network-footer a:focus-visible{outline:2px solid #8fe0bd;outline-offset:-2px}.network-footer{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px;padding:16px 3vw;border-top:1px solid var(--rule);font-size:13px}.network-footer-home{font-family:var(--serif);font-weight:700;color:var(--ink);text-decoration:none}.network-footer-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.network-footer-edition{color:var(--muted);text-decoration:none}.network-footer-edition:hover,.network-footer-home:hover{color:var(--green);text-decoration:underline}.network-footer-edition[aria-current="page"]{color:var(--green);font-weight:650}[data-theme="dark"] .network-bar{background:#070a09;border-bottom-color:#26302c}@media(min-width:1051px){.network-footer{padding-left:max(24px,calc((100vw - 1420px)/2 + 24px));padding-right:max(24px,calc((100vw - 1420px)/2 + 24px))}}@media(max-width:760px){.network-bar-inner{padding:0 0 0 14px;gap:12px}.network-home{padding-right:12px}.network-label{display:none}}@media print{.network-bar,.network-footer{display:none}}`;

module.exports = { HOME, EDITIONS, currentEdition, networkBar, networkFooter, NETWORK_CSS };
