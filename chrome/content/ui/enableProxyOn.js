/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is AutoProxy.
 *
 * The Initial Developer of the Original Code is
 * Wang Congming <lovelywcm@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */


// Matchers for disabled filters
var disabledBlacklistMatcher = new aup.Matcher();
var disabledWhitelistMatcher = new aup.Matcher();

/**
 * Updates matchers for disabled filters (global disabledBlacklistMatcher and
 * disabledWhitelistMatcher variables), called on each filter change.
 */
function reloadDisabledFilters(action, filter, additionalData)
{
  disabledBlacklistMatcher.clear();
  disabledWhitelistMatcher.clear();

  for each (let subscription in filterStorage.subscriptions)
  {
    if (subscription.disabled)
      continue;

    for each (let filter in subscription.filters)
      if (filter instanceof aup.RegExpFilter && filter.disabled)
        (filter instanceof aup.BlockingFilter ? disabledBlacklistMatcher : disabledWhitelistMatcher).add(filter);
  }
}
reloadDisabledFilters();
filterStorage.addFilterObserver(reloadDisabledFilters);
filterStorage.addSubscriptionObserver(reloadDisabledFilters);


/**
 * Used for creating "Enable Proxy On --" menu items.
 * Shared by context menu of statusbar, toolbar & sidebar.
 *
 * @param menuItem  document.getElementById
 * @param data  {RequestEntry} see requests.js
 */
function enableProxyOn(menuItem, data)
{
  // global, intended
  curItem = menuItem;

  // remove previously created items
  while (curItem.previousSibling && curItem.previousSibling.className == 'enableProxyOn')
    curItem.parentNode.removeChild(curItem.previousSibling);

  if (!data) return;

  var location = aup.makeURL(data.location);
  if (!proxy.isProxyableScheme(location)) return;

  // create "enable proxy on site" menu items
  makeSiteCheckbox(location, '||');

  var filter =
    aup.whitelistMatcher.matchesAny(data.location, data.typeDescr, data.docDomain, data.thirdParty) ||
    aup.blacklistMatcher.matchesAny(data.location, data.typeDescr, data.docDomain, data.thirdParty) ||
    disabledBlacklistMatcher.matchesAny(data.location, data.typeDescr, data.docDomain, data.thirdParty) ||
    disabledWhitelistMatcher.matchesAny(data.location, data.typeDescr, data.docDomain, data.thirdParty);

  // create "enable proxy on url" menu item
  if (filter && filter instanceof aup.BlockingFilter && filter.text.indexOf('||') != 0)
    makeNewCheckbox(filter, 'enableProxyOnUrl');

  // create "disable proxy on url" menu item
  if (filter && filter instanceof aup.WhitelistFilter && filter.text.indexOf('@@||') != 0)
    makeNewCheckbox(filter, 'disableProxyOnUrl');

  // create "disable proxy on site" menu items
  makeSiteCheckbox(location, '@@||');

  // create a menuseparator
  while (curItem.className == 'enableProxyOn') curItem = curItem.nextSibling;
  curItem.parentNode.insertBefore(cE('menuseparator'), curItem);
  curItem.previousSibling.className = 'enableProxyOn';
}


/**
 * @param location  {nsIURI}
 * @param prefix  {string} "||" or "@@||"
 */
function makeSiteCheckbox(location, prefix)
{
  var hostFilter = function() { return aup.Filter.fromText(prefix + host); }

  // avoid: .www..xxx.com
  var host = location.host.replace(/^\.+/, '').replace(/\.{2,}/, '.');

  // for host 'www.xxx.com', ignore 'www' unless rule '||www.xxx.com' is active.
  if (!isActive(hostFilter())) host = host.replace(/^www\./, '');

  while (true) {
    makeNewCheckbox(hostFilter(), prefix == '||' ? 'enableProxyOnSite' : 'disableProxyOnSite');

    // strip sub domain
    host = host.replace(/^[^\.]+\./, '');
    // com
    if (host.indexOf('.') <= 0) break;
    // com.cn
    if (/^(?:com|net|org|edu|gov)\.[a-z]{2}$/i.test(host) && !isActive(hostFilter())) break;
  }
}


function makeNewCheckbox(filter, labeltempl)
{
  if (filter instanceof aup.WhitelistFilter && !isActive(filter)) return;

  var filterText = filter.text.replace(/^@@/, '').replace(/^\|+/, '');
  var checkbox = cE('menuitem');
  checkbox.className = 'enableProxyOn';
  checkbox.setAttribute('type', 'checkbox');
  checkbox.setAttribute('label', aup.getString(labeltempl).replace(/--/, filterText));
  checkbox.addEventListener('command', function() { toggleFilter(filter); }, false);
  curItem.parentNode.insertBefore(checkbox, curItem);

  if (isActive(filter)) {
    checkbox.setAttribute('checked', true);
    checkbox.style.color = filter instanceof aup.BlockingFilter ? 'green' : 'red';
    if (labeltempl != 'enableProxyOnUrl') {
      for (; curItem.className == 'enableProxyOn'; curItem = curItem.nextSibling) {
        curItem.setAttribute('disabled', true);
        curItem.style.color = '';
      }
    }
  }

  curItem = checkbox;
}


/**
 * If the given filter is active, remove/disable it, Otherwise add/enable it.
 */
function toggleFilter(filter)
{
  if (filter.subscriptions.length) {
    if (filter.disabled || filter.subscriptions.some(function(subscription) !(subscription instanceof aup.SpecialSubscription))) {
      filter.disabled = !filter.disabled;
      filterStorage.triggerFilterObservers(filter.disabled ? "disable" : "enable", [filter]);
    }
    else
      filterStorage.removeFilter(filter);
  }
  else
    filterStorage.addFilter(filter);

  filterStorage.saveToDisk();

  if (typeof treeView != "undefined")
    treeView.boxObject.invalidate();
}


/**
 * @return true  if filter exist & not disabled
 */
function isActive(/**Filter*/ filter)
{
  return filter.subscriptions.length && !filter.disabled;
}


// TODO: reuse code for top window
