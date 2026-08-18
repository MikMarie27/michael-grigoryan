#!/usr/bin/env bash
# Switch the site from the github.io address to michael-grigoryan.com.
# Safe to run repeatedly: it refuses to do anything until the domain really exists.
set -euo pipefail

DOMAIN=michael-grigoryan.com
REPO=MikMarie27/michael-grigoryan
GHIO=https://mikmarie27.github.io/michael-grigoryan/

cd "$(dirname "$0")"

echo "Checking whether $DOMAIN is registered…"
if whois "$DOMAIN" 2>/dev/null | grep -qiE "no match|not found"; then
  echo
  echo "  Not registered yet — the registry has no record of it."
  echo "  GoDaddy is still provisioning order 4165950630. Try again later."
  exit 1
fi
echo "  Registered."

echo "Pointing the site at it…"
echo "$DOMAIN" > CNAME
for f in index.html sitemap.xml robots.txt; do
  [ -f "$f" ] && sed -i '' "s#${GHIO}#https://${DOMAIN}/#g" "$f"
done

git add -A
git commit -m "Point the site at $DOMAIN" >/dev/null
git push -q origin main
echo "  Pushed."

echo "Telling GitHub Pages about the domain…"
gh api -X PUT "repos/$REPO/pages" -f "cname=$DOMAIN" >/dev/null 2>&1 \
  || gh api -X POST "repos/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" -f "cname=$DOMAIN" >/dev/null
echo "  Done."

cat <<'NOTE'

Remaining, in the domain's DNS (delete GoDaddy's parked "A @ -> WebsiteBuilder Site" first):

  A      @     185.199.108.153
  A      @     185.199.109.153
  A      @     185.199.110.153
  A      @     185.199.111.153
  CNAME  www   mikmarie27.github.io

Once those resolve, turn on "Enforce HTTPS" in the repository's Settings -> Pages.
NOTE
