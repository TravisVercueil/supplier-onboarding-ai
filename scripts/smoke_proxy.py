"""Verify local Vite -> Django authentication and CSRF with browser-like headers."""
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5102').rstrip('/')
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(base + '/api/session', timeout=10).close()


def login(origin):
    token = next(cookie.value for cookie in jar if cookie.name == 'csrftoken')
    payload = {'username': 'reviewer', 'password': os.getenv('DEMO_PASSWORD', 'local-review-only')}
    request = urllib.request.Request(
        base + '/api/login', data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', 'X-CSRFToken': token, 'Origin': origin},
    )
    return client.open(request, timeout=10)


with login(base) as response:
    assert response.status == 200 and json.load(response)['user'] == 'reviewer'
with client.open(base + '/api/cases', timeout=10) as response:
    assert isinstance(json.load(response)['cases'], list)
try:
    login('https://untrusted.example').close()
    raise AssertionError('An untrusted origin was accepted')
except urllib.error.HTTPError as error:
    assert error.code == 403
print('PASS: proxy login, authenticated case access and rejection of an untrusted origin.')
