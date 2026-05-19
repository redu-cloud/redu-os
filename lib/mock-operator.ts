import type { AIBriefing } from '@/types';

export const mockAIBriefing: AIBriefing = {
  summary: 'Your startup had a productive day. You gained 24 new users, 156 waitlist signups, and completed 142 AI workflows.',
  keyEvents: [
    '24 new users signed up',
    '156 new waitlist signups',
    '3 new support tickets (onboarding confusion)',
    'Brief API outage (2 minutes, recovered)',
    '5 API timeout errors detected',
    '99.98% uptime maintained',
    '12 users completed getting-started flow',
    '2,458 newsletter subscribers reached',
  ],
  topIssue: 'Users are confused during the SSH key setup step in onboarding. This has caused 3 support tickets and a drop in conversion.',
  recommendation: 'Improve SSH key documentation with visual step-by-step guide and inline validation feedback.',
  nextAction: 'Create Zammad ticket to improve onboarding copy immediately.',
};

export const mockOperatorResponses: Record<string, string> = {
  'what happened today?': `Today was a great day for your startup! Here's what happened:

• 24 new users signed up (18% increase)
• 156 new waitlist signups added
• Your API had one short 2-minute outage but recovered
• 3 support tickets came in, mostly about SSH key confusion
• 99.98% uptime overall - excellent performance
• AI workflows processed 142 tasks automatically
• 12 users completed the getting-started flow

The most critical issue is that SSH key configuration is confusing users. This is causing support tickets and affecting conversion. I recommend updating your onboarding docs immediately with better screenshots and validation feedback.`,

  'what should i fix first?': `Based on current data, here's your priority list:

🔴 URGENT: SSH key setup confusion is costing you users. Update documentation and add inline validation feedback.

🟠 HIGH: API timeout errors detected - investigate infrastructure scaling. Monitor closely.

🟡 MEDIUM: Newsletter follow-up to 156 new waitlist users - send onboarding email sequence.

🟢 LOW: Add FAQ section to reduce support load - document common questions from today's tickets.

Start with SSH documentation. That will immediately improve your conversion rate.`,

  'summarize support issues.': `You have 8 open support tickets. Here's the breakdown:

🔴 High Priority (2):
• SSH key validation errors (3 users) - blocking instance creation
• API integration guide unclear (1 user) - needs better docs

🟡 Medium Priority (4):
• Billing question (1 user)
• Feature request for custom domains (1 user)
• Performance tuning advice needed (1 user)
• Email notification setup (1 user)

🟢 Low Priority (2):
• General questions (2 users) - can be addressed in FAQ

Recommendation: Create an SSH key guide ASAP. This will resolve 3 tickets immediately.`,

  'why are users not converting?': `Based on analytics and support data, here's why users aren't converting:

1. SSH Key Friction (Primary blocker - 25% of signup attempts fail here)
   • Step is unclear in documentation
   • Validation errors are confusing
   • No visual guide available
   Fix: Add screenshots, step-by-step guide, inline validation feedback

2. Onboarding Length
   • 12/24 users complete the full flow (50% completion)
   • Most drop off at deployment step
   Fix: Simplify to 3-step quick-start, advanced features in separate flow

3. Documentation Quality
   • Most support questions are about "how do I" basics
   • Users aren't finding existing docs
   Fix: Better SEO, improve navigation, add video guides

4. Email Nurturing Gap
   • 156 waitlist signups but weak follow-up
   Fix: Send getting-started email immediately after signup

Quick wins to boost conversion by 15-20%:
✓ Fix SSH docs (this week)
✓ Improve email follow-up (today)
✓ Simplify onboarding flow (this week)`,

  'create a weekly founder update.': `## Weekly Founder Update - Week of May 19

### Growth
• New users: 24 (+18% vs last week)
• Waitlist: 156 new signups (total: 892)
• Conversion rate: 3.2% (+0.4%)

### Product
• 142 AI workflows completed automatically
• 12 users through full onboarding
• 3 support tickets (2 high priority)

### Infrastructure
• Uptime: 99.98% (1 brief outage)
• API performance: 5 timeout errors detected
• 3 app errors tracked and resolved

### Top Priority This Week
🎯 Fix SSH onboarding step - blocking 25% of conversions
🎯 Improve documentation and email nurturing
🎯 Monitor API performance after timeout spike

### Win
Great uptime and AI automation is working well. The team did amazing work maintaining 99.98% uptime.`,

  'check if the product is healthy.': `Your product is healthy overall. Here's the diagnostic:

✅ Performance: 99.98% uptime - excellent
⚠️  Stability: 5 API timeouts detected - needs monitoring
✅ User Experience: 50% onboarding completion - acceptable
⚠️  Friction: SSH setup causing support tickets - needs fix
✅ Engagement: 142 AI workflows run - strong automation
✅ Growth: 24 new users (+18%) - solid trajectory

Status: HEALTHY with minor issues in infrastructure and docs

Recommendations:
1. Investigate timeout root cause (this week)
2. Fix SSH documentation (today)
3. Monitor API for patterns
4. Scale infrastructure if growth continues

Overall: Product is solid, team is shipping well. Focus on removing friction and scaling.`,

  'draft a newsletter for new users.': `Subject: Welcome to reduOS – Your startup AI command center

---

Hi there! 👋

Thanks for joining reduOS. You're part of a growing community of founders and builders using private AI to run smarter startups.

## What You Can Do Now

✨ Connect your startup stack
Link your tools (support, analytics, monitoring) and see everything in one command center.

🤖 Get daily AI insights
Wake up to a personalized briefing of what happened in your startup yesterday.

⚡ Automate routine work
Let AI handle customer support, documentation, and insights so you focus on strategy.

## Getting Started in 3 Steps

1. Create your instance (takes 2 min)
2. Connect your first integration
3. See your first AI briefing

[Launch reduOS]

## Quick Tips
• Start with Umami (analytics) or Zammad (support) - easiest to set up
• Check out the AI Operator page for daily insights
• Join our community Slack to see what others are building

You're running the future of startup infrastructure.

-- The reduOS Team

P.S. Hit a snag? Our support team is ready to help. reply@reduos.cloud`,

  'create a support ticket for this issue.': `I'll create a support ticket for you in Zammad. Here's what I'm sending:

**Title:** User cannot create instance - SSH key validation error

**Priority:** High

**Category:** Onboarding / Documentation

**Description:**
Multiple users (3+ today) are unable to proceed through instance creation due to confusing SSH key validation. This is a high-priority friction point affecting conversion.

**Steps to Reproduce:**
1. Follow onboarding flow
2. Reach SSH key step
3. Users report unclear error messages

**Impact:** Conversion bottleneck, support volume increase

**Suggested Solution:** Improve documentation with visual guides and clearer validation feedback

**Related Integration:** Zammad support system

Ticket created! Your support team will review and prioritize.`,

  'default': `I'm your AI Operator, built to help you run your startup from one command center.

Try asking me:
• What happened today?
• What should I fix first?
• Why are users not converting?
• Summarize support issues.
• Check if the product is healthy.
• Create a weekly founder update.
• Draft a newsletter for new users.

You can also ask about specific integrations or request actions. I'll always give you clear, actionable insights.`,
};
