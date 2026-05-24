#!/usr/bin/env bash
set -euo pipefail

UMAMI_URL="${UMAMI_URL:-http://127.0.0.1:3000}"
UMAMI_USER="${UMAMI_USER:-admin}"
UMAMI_PASS="${UMAMI_PASS:-umami}"

TOKEN=$(curl -sS -X POST "$UMAMI_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$UMAMI_USER\",\"password\":\"$UMAMI_PASS\"}" \
  | jq -r '.token // .authToken // empty')

WEBSITE_ID=$(curl -sS "$UMAMI_URL/api/websites" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[0].id')

START_AT=$(date -u -d "24 hours ago" +%s000)
END_AT=$(date -u +%s000)

get_json() {
  curl -sS "$1" -H "Authorization: Bearer $TOKEN"
}

STATS=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/stats?startAt=$START_AT&endAt=$END_AT")
PAGEVIEWS=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/pageviews?startAt=$START_AT&endAt=$END_AT&unit=hour")
TOP_PAGES=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=path")
REFERRERS=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=referrer")
EVENT_NAMES=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=event")
EVENTS=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/events?startAt=$START_AT&endAt=$END_AT")
DEVICES=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=device")
COUNTRIES=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=country")
BROWSERS=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=browser")
OS_DATA=$(get_json "$UMAMI_URL/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=os")

jq -n \
  --arg website_id "$WEBSITE_ID" \
  --arg start_at "$START_AT" \
  --arg end_at "$END_AT" \
  --argjson stats "$STATS" \
  --argjson pageviews "$PAGEVIEWS" \
  --argjson top_pages "$TOP_PAGES" \
  --argjson referrers "$REFERRERS" \
  --argjson event_names "$EVENT_NAMES" \
  --argjson events "$EVENTS" \
  --argjson devices "$DEVICES" \
  --argjson countries "$COUNTRIES" \
  --argjson browsers "$BROWSERS" \
  --argjson os "$OS_DATA" \
  '{
    source: "umami",
    purpose: "ai_enrichment",
    website_id: $website_id,
    time_range: {
      start_at: $start_at,
      end_at: $end_at
    },
    stats: $stats,
    pageviews: $pageviews,
    top_pages: $top_pages,
    referrers: $referrers,
    event_names: $event_names,
    events: $events,
    devices: $devices,
    countries: $countries,
    browsers: $browsers,
    os: $os
  }'
