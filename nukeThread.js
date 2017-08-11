'use strict';
/* global snoowrap */
var REDDIT_APP_ID = 'Nm8ORveyn95TYw';
var REDIRECT_URI = 'https://not-an-aardvark.github.io/reddit-thread-nuke/';

var USER_AGENT = 'reddit thread nuke by /u/not_an_aardvark || https://github.com/not-an-aardvark/reddit-thread-nuke';
var REQUIRED_SCOPES = ['modposts', 'read', 'identity'];
var cachedRequester;
var accessTokenPromise;
var removedCount;

var query = parseQueryString(location.search);
var cookies = parseCookieString(document.cookie);

function parseQueryString (str) {
  if (!str) {
    return {};
  }
  var obj = {};
  var pieces = str.slice(1).split('&');
  for (var i = 0; i < pieces.length; i++) {
    var pair = pieces[i].split('=');
    obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return obj;
}

function parseCookieString (cookieString) {
  var obj = {};
  var splitCookies = cookieString.split('; ');
  splitCookies.forEach(function (cookie) {
    var pair = cookie.split('=');
    obj[pair[0]] = pair[1];
  });
  return obj;
}

var getAuthRedirect = function (state) {
  return `https://reddit.com/api/v1/authorize?client_id=${REDDIT_APP_ID}&response_type=code&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&duration=temporary&scope=${REQUIRED_SCOPES.join('%2C')}`;
};

function parseUrl (url) {
  var matches = url.match(/^(?:http(?:s?):\/\/)?(?:\w*\.)?reddit\.com\/(?:r\/\w{1,21}\/)?comments\/(\w{1,10})(?:\/[^\/\?]{1,100})?(?:\/(\w{1,10}))?\/?(?:\?.*)?$/);
  if (!matches) {
    throw new TypeError('Invalid URL. Please enter the URL of a reddit Submission or Comment.');
  }
  return matches;
}

function getExpandedContent (requester, urlMatches) {
  return (urlMatches[2] ? requester.get_comment(urlMatches[2]) : requester.get_submission(urlMatches[1])).expand_replies();
}

function deepRemove (content, preserveDistinguished) {
  var replies = content.comments || content.replies;
  var removeCurrentItem = content.distinguished && preserveDistinguished || content.banned_by !== null
    ? Promise.resolve()
    : content.remove().tap(incrementCounter);
  return Promise.all(Array.from(replies).map(function (reply) {
    return deepRemove(reply, preserveDistinguished);
  }).concat([removeCurrentItem]));
}

function deepApprove (content, preserveRemoved, name) {
  var replies = content.comments || content.replies;
  var approveCurrentItem = !content.banned_by || preserveRemoved && content.banned_by.name !== name
    ? Promise.resolve()
    : content.approve().tap(incrementCounter);
  return Promise.all(Array.from(replies).map(function (reply) {
    return deepApprove(reply, preserveRemoved, name);
  }).concat([approveCurrentItem]));
}

function getAccessToken (code) {
  if (accessTokenPromise) {
    return accessTokenPromise;
  }
  accessTokenPromise = cookies.access_token && !code
    ? Promise.resolve(cookies.access_token)
    : snoowrap.prototype.credentialed_client_request.call({
      user_agent: USER_AGENT,
      client_id: REDDIT_APP_ID,
      client_secret: ''
    }, {
      method: 'post',
      url: 'https://www.reddit.com/api/v1/access_token',
      form: {grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI}
    }).then(function (response) {
      if (!response.access_token) {
        throw new Error('Authentication failed');
      }
      document.cookie = `access_token=${response.access_token}; max-age=3600; secure`;
      cookies.access_token = response.access_token;
      return response.access_token;
    });
  return accessTokenPromise;
}

function incrementCounter () {
  document.getElementById('removed-count').innerHTML = ++removedCount;
}

function getRequester (access_token) {
  if (cachedRequester) {
    return cachedRequester;
  }
  cachedRequester = new snoowrap({user_agent: USER_AGENT, access_token});
  cachedRequester.config({debug: true, continue_after_ratelimit_error: true});
  return cachedRequester;
}

function nukeThread (url, toNuke) {
  var parsedUrl;
  removedCount = 0;
  try {
    parsedUrl = parseUrl(url);
  } catch (err) {
    document.getElementById('url-error-message').innerHTML = err.message;
    document.getElementById('url-error-message').style.display = 'block';
    throw err;
  }
  document.getElementById('url-error-message').style.display = 'none';
  document.getElementById('error-output').style.display = 'none';
  document.getElementById('loading-message').style.display = 'block';
  document.getElementById('done-message').style.display = 'none';
  return getAccessToken(query.code)
    .then(getRequester)
    .then(function (r) {
      return Promise.all([r.getMe(), getExpandedContent(r, parsedUrl)])
        .then(function ([{name},content]) {
        if (toNuke === "nuke") {
            return deepRemove(content, document.getElementById('preserve-distinguished-checkbox').checked);
        } else {
            return deepApprove(content, document.getElementById('preserve-removed-checkbox').checked, name);
        }
      })
    }).then(function () {
      document.getElementById('done-message').style.display = 'block';
    })
    .catch(function (err) {
      document.getElementById('error-output').style.display = 'block';
      document.getElementById('loading-message').style.display = 'none';
      document.getElementById('done-message').style.display = 'none';
      throw err;
    });
}

function showHide() {
  var selected = document.getElementById('to-nuke').value;
  var distinguished = document.getElementById('distinguished-container');
  var removed = document.getElementById('removed-container');
  distinguished.style.display = selected == "nuke" ? "block" : "none";
  removed.style.display = selected == "unnuke" ? "block" : "none"
}

function onSubmitClicked () { // eslint-disable-line no-unused-vars
  var url = document.getElementById('thread-url-box').value;
  var preserveDistinguished = document.getElementById('preserve-distinguished-checkbox').checked;
  var preserveRemoved = document.getElementById('preserve-removed-checkbox').checked;
  var toNuke = document.getElementById("to-nuke").value;
  if (cookies.access_token || query.code) {
    return nukeThread(url, toNuke);
  }
<<<<<<< HEAD
<<<<<<< HEAD
  location = getAuthRedirect(JSON.stringify({url, preserveDistinguished, preserveRemoved, toNuke}));
=======
  location = getAuthRedirect(JSON.stringify({url, preserveDistinguished, preserveRemoved}));
>>>>>>> 5330798... add un-nuke (#1)
=======
  location = getAuthRedirect(JSON.stringify({url, preserveDistinguished, preserveRemoved, toNuke}));
>>>>>>> b57edcf... place redirect fix back in
}

document.addEventListener('DOMContentLoaded', function () {
  if (query.state && query.code) {
    var parsedState = JSON.parse(decodeURIComponent(query.state));
    var url = decodeURIComponent(parsedState.url);
    document.getElementById('thread-url-box').value = url;
    document.getElementById('preserve-distinguished-checkbox').checked = parsedState.preserveDistinguished;
    document.getElementById('preserve-removed-checkbox').checked = parsedState.preserveRemoved;
<<<<<<< HEAD
<<<<<<< HEAD
    document.getElementById("to-nuke").value = parsedState.toNuke;
=======
>>>>>>> 5330798... add un-nuke (#1)
=======
    document.getElementById("to-nuke").value = parsedState.toNuke;
>>>>>>> b57edcf... place redirect fix back in
    var toNuke = document.getElementById("to-nuke").value;
    nukeThread(url, toNuke);
  }