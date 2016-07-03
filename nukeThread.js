'use strict';
/* global snoowrap */
const REDDIT_APP_ID = 'Nm8ORveyn95TYw';
const REDIRECT_URI = 'https://not-an-aardvark.github.io/reddit-thread-nuke/';

const USER_AGENT = 'reddit thread nuke by /u/not_an_aardvark || https://github.com/not-an-aardvark/reddit-thread-nuke';
const REQUIRED_SCOPES = ['modposts', 'read'];
let cachedRequester;
let accessTokenPromise;
let removedCount;

const query = parseQueryString(location.search);
const cookies = parseCookieString(document.cookie);

function parseQueryString (str) {
  if (!str) {
    return {};
  }
  const obj = {};
  const pieces = str.slice(1).split('&');
  for (let i = 0; i < pieces.length; i++) {
    const pair = pieces[i].split('=');
    obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return obj;
}

function parseCookieString (cookieString) {
  const obj = {};
  const splitCookies = cookieString.split('; ');
  splitCookies.forEach(cookie => {
    const pair = cookie.split('=');
    obj[pair[0]] = pair[1];
  });
  return obj;
}

const getAuthRedirect = state =>
`https://reddit.com/api/v1/authorize
?client_id=${REDDIT_APP_ID}
&response_type=code
&state=${encodeURIComponent(state)}
&redirect_uri=${encodeURIComponent(REDIRECT_URI)}
&duration=temporary
&scope=${REQUIRED_SCOPES.join('%2C')}
`;

function parseUrl (url) {
  const matches = url.match(/^(?:http(?:s?):\/\/)?(?:\w*\.)?reddit.com\/(?:r\/\w{1,21}\/)?comments\/(\w{1,10})(?:\/[\w\u00c0-\u017f]{1,100})?(?:\/(\w{1,10})|\/?)?(?:\?.*)?$/);
  if (!matches) {
    throw new TypeError('Invalid URL. Please enter the URL of a reddit Submission or Comment.');
  }
  return matches;
}

function getExpandedContent (requester, urlMatches) {
  return (urlMatches[2] ? requester.get_comment(urlMatches[2]) : requester.get_submission(urlMatches[1])).expand_replies();
}

function deepRemove (content, preserveDistinguished) {
  const replies = content.comments || content.replies;
  const removeCurrentItem = content.distinguished && preserveDistinguished || content.banned_by !== null
    ? Promise.resolve()
    : content.remove().tap(incrementCounter);
  return Promise.all(Array.from(replies).map(reply => deepRemove(reply, preserveDistinguished)).concat([removeCurrentItem]));
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
    }).then(response => {
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

function nukeThread (url) {
  let parsedUrl;
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
    .then(r => getExpandedContent(r, parsedUrl))
    .then(content => deepRemove(content, document.getElementById('preserve-distinguished-checkbox').checked))
    .then(() => {
      document.getElementById('done-message').style.display = 'block';
    })
    .catch(err => {
      document.getElementById('error-output').style.display = 'block';
      document.getElementById('loading-message').style.display = 'none';
      document.getElementById('done-message').style.display = 'none';
      throw err;
    });
}

/* eslint-disable no-unused-vars */
function onSubmitClicked () {
  /* eslint-enable no-unused-vars */
  const url = document.getElementById('thread-url-box').value;
  const preserveDistinguished = document.getElementById('preserve-distinguished-checkbox').checked;
  if (cookies.access_token || query.code) {
    return nukeThread(url);
  }
  location = getAuthRedirect(JSON.stringify({url, preserveDistinguished}));
}

document.addEventListener('DOMContentLoaded', () => {
  if (query.state && query.code) {
    const parsedState = JSON.parse(decodeURIComponent(query.state));
    const url = decodeURIComponent(parsedState.url);
    document.getElementById('thread-url-box').value = url;
    document.getElementById('preserve-distinguished-checkbox').checked = parsedState.preserveDistinguished;
    nukeThread(url);
  }
});
