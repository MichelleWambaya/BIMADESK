// Single source of truth for the user guide. The Settings handbook and
// the first-run tour both read from this, so they can't drift apart as
// the product changes.
//
// TO ADD A WALKTHROUGH VIDEO: put its URL in GUIDE_VIDEO_URL below and a
// player appears at the top of the handbook and in the tour's final
// step. Until then, both simply omit the video section rather than
// showing a broken player. Any embeddable URL works (YouTube, Vimeo,
// Loom, or a self-hosted MP4). For YouTube use the /embed/ form, e.g.
// https://www.youtube.com/embed/VIDEO_ID
export const GUIDE_VIDEO_URL: string | null = null;
export const GUIDE_VIDEO_TITLE = "A quick tour of BimAdmin";

export interface GuideStep {
  heading: string;
  body: string;
}

export interface GuideChapter {
  id: string;
  title: string;
  summary: string;
  steps: GuideStep[];
}

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "Bring your book of business in and get the dashboard telling you what to do.",
    steps: [
      {
        heading: "Import your existing clients",
        body: "Go to Settings, then Data, then Import. You can upload a CSV, Excel file, PDF, or Word document. Excel and CSV give the most reliable results because they describe real rows and columns. Whatever you upload, you map your columns to BimAdmin's fields and see a preview before anything is saved, so nothing is imported blind.",
      },
      {
        heading: "Add your first policy",
        body: "Open a client, go to the Policies tab, and choose Add policy. The renewal date you enter here is what drives every reminder afterwards, so it is worth getting right. You can always correct it later by clicking the date directly in any policy list.",
      },
      {
        heading: "Let the dashboard lead your day",
        body: "Once you have clients and policies in, the dashboard answers one question: what needs attention today. Follow-ups due, policies expiring soon, and your pipeline are all there. Start your day here rather than hunting through lists.",
      },
    ],
  },
  {
    id: "renewals",
    title: "Renewals and automation",
    summary: "The part that saves you the most time, and the reason nothing lapses quietly.",
    steps: [
      {
        heading: "How renewal reminders work",
        body: "Every night, BimAdmin checks every active policy against its expiry date. When a policy hits one of your configured reminder points, you get a notification, and if you have a matching automation rule turned on, a task is created and assigned automatically. This runs on our servers, so it keeps working whether or not you have the app open.",
      },
      {
        heading: "Choosing your reminder points",
        body: "Settings, then Reminder settings, controls how many days before expiry you want to hear about a policy. The default is 90, 60, 30, 14, 7, 3, and 1 day out. Add or remove points to match how far ahead you like to work.",
      },
      {
        heading: "Turning automations on and off",
        body: "Settings, then Automations, lists every rule. Some run the moment something happens, like creating a call task when you add a new lead. Others are checked once a day, like the renewal reminders. Each rule says which kind it is, and you can switch any of them off.",
      },
      {
        heading: "Starting a renewal",
        body: "From the Renewals page, Start Renewal creates a high-priority task for that policy right away. Group the page by week, month, or year depending on how far ahead you are planning.",
      },
    ],
  },
  {
    id: "clients",
    title: "Clients and documents",
    summary: "Everything about one person in one place.",
    steps: [
      {
        heading: "The client record",
        body: "Opening a client shows their policies, quotations, communications, tasks, documents, and a full timeline of everything that has happened. This is meant to replace checking three places before you pick up the phone.",
      },
      {
        heading: "Storing documents",
        body: "The Documents tab on any client takes any file up to 10MB: ID scans, policy schedules, quotes, medical forms. Files are stored privately and only people in your organization can open them. Click a document to view it, or use the download button to save a copy.",
      },
      {
        heading: "Handling duplicates",
        body: "If you add a client whose phone number already exists, BimAdmin tells you and offers to open the existing record instead. To clean up duplicates you already have, use Settings, then Data, then Possible duplicates, where you can merge two records and choose which one to keep.",
      },
    ],
  },
  {
    id: "communication",
    title: "Talking to clients",
    summary: "Calls, WhatsApp, SMS, and email, all logged against the client.",
    steps: [
      {
        heading: "Logging a call",
        body: "The Call button on a client opens your phone's dialer. BimAdmin cannot tell when the call ends, so afterwards you record the outcome yourself and, if useful, schedule a follow-up in the same step.",
      },
      {
        heading: "Sending messages and email",
        body: "Message and Email use your saved templates, filling in the client's name, policy type, expiry date, and premium automatically. Every send is logged on the client's timeline so you always know what they last heard from you.",
      },
      {
        heading: "About WhatsApp",
        body: "WhatsApp has a rule set by Meta, not by us: you can only send a free-form message within 24 hours of the client messaging you first. Outside that window, sends will be rejected. SMS and email have no such restriction, so they are more dependable for proactive reminders.",
      },
      {
        heading: "Message allowances",
        body: "Each plan includes a set number of messages per month, because SMS and WhatsApp cost real money to deliver. You can see where you stand on the Billing page, and upgrade if you need more.",
      },
    ],
  },
  {
    id: "team-billing",
    title: "Team and billing",
    summary: "Adding staff, and paying for the plan you need.",
    steps: [
      {
        heading: "Inviting a teammate",
        body: "Settings, then Team, creates an invite link you send to your colleague yourself, over WhatsApp or email. When they open it and sign up, they join your workspace rather than creating their own. How many teammates you can add depends on your plan.",
      },
      {
        heading: "Paying with M-Pesa",
        body: "Choose a plan on the Billing page and enter your M-Pesa number. You will get a prompt on your phone to enter your PIN, the same as any other M-Pesa payment. Card payment is also available if you prefer.",
      },
      {
        heading: "Automatic renewal",
        body: "If you pay by card and your bank allows it, your card is saved so your subscription renews without you doing anything. You can turn this off any time on the Billing page. M-Pesa cannot renew automatically, because Safaricom requires you to approve every payment, so you will get a reminder instead.",
      },
    ],
  },
  {
    id: "your-account",
    title: "Your account",
    summary: "Making the app yours, and keeping client data safe.",
    steps: [
      {
        heading: "Appearance and accessibility",
        body: "Settings, then Appearance, has light and dark themes, three text sizes, and a reduce motion option if animations bother you. These are saved per device, so your phone and laptop can differ.",
      },
      {
        heading: "Automatic sign out",
        body: "Because BimAdmin holds your clients' personal information, you are signed out automatically after 20 minutes of inactivity, with a warning at 15 minutes. This matters most on a shared or borrowed device.",
      },
      {
        heading: "Deleting things",
        body: "Deleting a client or lead removes everything of theirs, including policies, tasks, notes, and documents. Because that cannot be undone, you have to type the record's name to confirm. The same applies to deleting your whole account, under Settings, then Account.",
      },
    ],
  },
];
